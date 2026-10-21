import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  anchorAtPoint,
  buildDrawing,
  draftAnchors,
  hasHorizontalEdge,
  horizontalEdgePartner,
  moveAnchors,
  newDrawingId,
  pixelOfAnchor,
  type AnchorScene,
} from '@/components/charts/drawings/interaction'
import {
  hitTestBody,
  hitTestHandle,
  type Point,
  type PlotArea,
} from '@/components/charts/drawings/geometry'
import { shapeGeometry, type ShapeContext } from '@/components/charts/drawings/shapes'
import {
  anchorCountFor,
  placementType,
  type DrawingAnchor,
  type DrawingObject,
  type DrawingTool,
  type PlacementTool,
} from '@/components/charts/drawings/model'
import type { PlacedDrawing } from '@/components/charts/layers/DrawingLayer'

/** Pointer travel that turns a press on a placement tool into a drag. */
const DRAG_PLACEMENT_THRESHOLD_PX = 4

export type DrawingScene = AnchorScene & {
  plot: PlotArea
  formatTime: (time: number) => string
}

export type DrawingInteractionOptions = {
  tool: DrawingTool
  drawings: DrawingObject[]
  hideAll: boolean
  /** Keep the placement tool armed after each drawing instead of returning to the cursor. */
  keepTool: boolean
  scene: DrawingScene
  onCommit: (next: DrawingObject[]) => void
  onToolChange: (tool: DrawingTool) => void
  /** Changing this (symbol or timeframe) drops any gesture, placement or text edit in progress. */
  resetKey: string
}

type Placing = {
  tool: PlacementTool
  anchors: DrawingAnchor[]
  /** Where the press that placed the last anchor began; a drag to a second anchor completes the drawing. */
  pressed: Point | null
}

type Gesture = {
  kind: 'move' | 'handle'
  id: string
  index: number
  startPoint: Point
  startAnchors: DrawingAnchor[]
  anchors: DrawingAnchor[]
  moved: boolean
}

/** Text note being typed; `id` is null while the note is new. */
export type TextEdit = {
  id: string | null
  anchor: DrawingAnchor
  text: string
}

type Hit = { kind: 'handle'; id: string; index: number } | { kind: 'body'; id: string } | null

/**
 * Pointer and keyboard state for drawings: placement, selection, moves, handle reshaping and
 * inline text notes. Every finished change is handed to `onCommit` as a whole list, which keeps
 * undo, persistence and the Escape rules in one place.
 */
export function useDrawingInteraction({
  tool,
  drawings,
  hideAll,
  keepTool,
  scene,
  onCommit,
  onToolChange,
  resetKey,
}: DrawingInteractionOptions) {
  const [placing, setPlacingState] = useState<Placing | null>(null)
  const placingRef = useRef<Placing | null>(null)
  const [gesture, setGestureState] = useState<Gesture | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const [hover, setHover] = useState<Hit>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<TextEdit | null>(null)

  const setPlacing = useCallback((next: Placing | null) => {
    placingRef.current = next
    setPlacingState(next)
  }, [])
  const setGesture = useCallback((next: Gesture | null) => {
    gestureRef.current = next
    setGestureState(next)
  }, [])

  useEffect(() => {
    setPlacing(null)
    setPointer(null)
    setGesture(null)
    setEditing(null)
    setSelectedId(null)
  }, [resetKey, setPlacing, setGesture])

  // A tool switch abandons a drawing still being placed with the previous tool.
  useEffect(() => {
    setPlacing(null)
    setPointer(null)
  }, [tool, setPlacing])

  const visible = useMemo(
    () => (hideAll ? [] : drawings.filter((drawing) => !drawing.hidden)),
    [drawings, hideAll],
  )

  const shapeContext = useMemo<ShapeContext>(
    () => ({
      plot: scene.plot,
      format: scene.format,
      yOfPrice: (price) => scene.priceScale(price),
      formatTime: scene.formatTime,
    }),
    [scene],
  )

  const gestureId = gesture?.id
  const gestureAnchors = gesture?.anchors

  const placed = useMemo<PlacedDrawing[]>(
    () =>
      visible.map((drawing) => {
        const live =
          drawing.id === gestureId && gestureAnchors
            ? ({ ...drawing, anchors: gestureAnchors } as DrawingObject)
            : drawing
        const points = live.anchors.map((anchor) => pixelOfAnchor(anchor, scene))
        return { drawing: live, geometry: shapeGeometry(live, points, shapeContext) }
      }),
    [visible, gestureId, gestureAnchors, scene, shapeContext],
  )

  const hitTest = useCallback(
    (point: Point): Hit => {
      const selected = placed.find((entry) => entry.drawing.id === selectedId)
      if (selected) {
        const index = hitTestHandle(selected.geometry.handles, point)
        if (index >= 0) return { kind: 'handle', id: selected.drawing.id, index }
      }
      for (let index = placed.length - 1; index >= 0; index -= 1) {
        const entry = placed[index]
        if (hitTestBody(entry.geometry, point)) return { kind: 'body', id: entry.drawing.id }
      }
      return null
    },
    [placed, selectedId],
  )

  const findDrawing = useCallback(
    (id: string) => drawings.find((drawing) => drawing.id === id),
    [drawings],
  )

  const finishPlacement = useCallback(
    (placementTool: PlacementTool, anchors: DrawingAnchor[]) => {
      const id = newDrawingId()
      onCommit([...drawings, buildDrawing(placementTool, anchors, id)])
      setSelectedId(id)
      setPlacing(null)
      setPointer(null)
      if (!keepTool) onToolChange('cursor')
    },
    [drawings, keepTool, onCommit, onToolChange, setPlacing],
  )

  /** Anchor for the next click of a placement, honouring Shift on a horizontal edge. */
  const nextAnchor = useCallback(
    (point: Point, placementTool: PlacementTool, placed: DrawingAnchor[], shift: boolean) => {
      const constrained =
        shift && placed.length === 1 && hasHorizontalEdge(placementType(placementTool))
      return anchorAtPoint(point, scene, constrained ? placed[0].price : undefined)
    },
    [scene],
  )

  /** Mouse down on the chart. Returns true when the press belongs to a drawing, so it does not pan. */
  const press = useCallback(
    (point: Point, shift: boolean): boolean => {
      if (editing) return false

      if (tool === 'cursor') {
        const hit = hitTest(point)
        if (!hit) {
          setSelectedId(null)
          return false
        }
        const drawing = findDrawing(hit.id)
        if (!drawing) return false
        setSelectedId(hit.id)
        if (drawing.locked) return true
        if (hit.kind === 'handle') {
          setGesture({
            kind: 'handle',
            id: drawing.id,
            index: hit.index,
            startPoint: point,
            startAnchors: drawing.anchors,
            anchors: drawing.anchors,
            moved: false,
          })
        } else {
          setGesture({
            kind: 'move',
            id: drawing.id,
            index: 0,
            startPoint: point,
            startAnchors: drawing.anchors,
            anchors: drawing.anchors,
            moved: false,
          })
        }
        return true
      }

      if (tool === 'text') {
        setEditing({ id: null, anchor: anchorAtPoint(point, scene), text: '' })
        return true
      }

      const current = placingRef.current
      if (!current) {
        const anchor = anchorAtPoint(point, scene)
        if (anchorCountFor(tool) === 1) {
          finishPlacement(tool, [anchor])
        } else {
          setPlacing({ tool, anchors: [anchor], pressed: point })
          setPointer(point)
        }
        return true
      }
      const anchor = nextAnchor(point, current.tool, current.anchors, shift)
      const anchors = [...current.anchors, anchor]
      if (anchors.length >= anchorCountFor(current.tool)) {
        finishPlacement(current.tool, anchors)
      } else {
        setPlacing({ ...current, anchors, pressed: point })
      }
      return true
    },
    [
      editing,
      tool,
      hitTest,
      findDrawing,
      setGesture,
      scene,
      setPlacing,
      nextAnchor,
      finishPlacement,
    ],
  )

  /** Mouse move over the chart, for placement previews, drags and hover highlighting. */
  const move = useCallback(
    (point: Point, shift: boolean) => {
      const active = gestureRef.current
      if (active) {
        const dx = point.x - active.startPoint.x
        const dy = point.y - active.startPoint.y
        let anchors: DrawingAnchor[]
        if (active.kind === 'move') {
          anchors = moveAnchors(active.startAnchors, dx, dy, scene)
        } else {
          anchors = [...active.startAnchors]
          const drawing = findDrawing(active.id)
          const partner = drawing ? horizontalEdgePartner(drawing, active.index) : null
          const fixed = shift && partner !== null ? active.startAnchors[partner].price : undefined
          anchors[active.index] = anchorAtPoint(point, scene, fixed)
        }
        setGesture({
          ...active,
          anchors,
          moved: active.moved || dx !== 0 || dy !== 0,
        })
        return
      }

      if (placingRef.current) {
        setPointer(point)
        return
      }

      if (tool === 'cursor' && !editing) {
        setHover(hitTest(point))
      }
    },
    [scene, findDrawing, setGesture, tool, editing, hitTest],
  )

  /** Mouse up. Completes a drag placement or commits a finished move or reshape. */
  const release = useCallback(
    (point: Point, shift: boolean) => {
      const active = gestureRef.current
      if (active) {
        setGesture(null)
        if (active.moved) {
          onCommit(
            drawings.map((drawing) =>
              drawing.id === active.id
                ? ({ ...drawing, anchors: active.anchors } as DrawingObject)
                : drawing,
            ),
          )
        }
        return
      }

      const current = placingRef.current
      if (!current || !current.pressed) return
      const travel = Math.hypot(point.x - current.pressed.x, point.y - current.pressed.y)
      if (
        anchorCountFor(current.tool) === 2 &&
        current.anchors.length === 1 &&
        travel > DRAG_PLACEMENT_THRESHOLD_PX
      ) {
        const anchor = nextAnchor(point, current.tool, current.anchors, shift)
        finishPlacement(current.tool, [...current.anchors, anchor])
      } else {
        setPlacing({ ...current, pressed: null })
      }
    },
    [setGesture, onCommit, drawings, nextAnchor, finishPlacement, setPlacing],
  )

  /** Pointer left the chart: a drag ends where it was, and the hover and draft clear. */
  const leave = useCallback(() => {
    setHover(null)
    setPointer(null)
    if (gestureRef.current) release(gestureRef.current.startPoint, false)
    const current = placingRef.current
    if (current?.pressed) setPlacing({ ...current, pressed: null })
  }, [release, setPlacing])

  /** Double click on a text note edits it in place. */
  const doubleClick = useCallback(
    (point: Point): boolean => {
      const hit = hitTest(point)
      if (!hit || hit.kind !== 'body') return false
      const drawing = findDrawing(hit.id)
      if (!drawing || drawing.type !== 'text' || drawing.locked) return false
      setSelectedId(drawing.id)
      setEditing({ id: drawing.id, anchor: drawing.anchors[0], text: drawing.options.text })
      return true
    },
    [hitTest, findDrawing],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    onCommit(drawings.filter((drawing) => drawing.id !== selectedId))
    setSelectedId(null)
  }, [drawings, onCommit, selectedId])

  /** Keys handled by drawings: Escape steps back one state at a time, Delete removes the selection. */
  const keyDown = useCallback(
    (key: string): boolean => {
      if (editing) return false
      if (key === 'Escape') {
        if (gestureRef.current) {
          setGesture(null)
          return true
        }
        if (placingRef.current) {
          setPlacing(null)
          setPointer(null)
          return true
        }
        if (selectedId) {
          setSelectedId(null)
          return true
        }
        return false
      }
      if ((key === 'Delete' || key === 'Backspace') && selectedId) {
        deleteSelected()
        return true
      }
      return false
    },
    [editing, selectedId, setGesture, setPlacing, deleteSelected],
  )

  const commitText = useCallback(
    (text: string) => {
      if (!editing) return
      const trimmed = text.replace(/\s+$/u, '')
      if (editing.id) {
        const id = editing.id
        if (trimmed.trim() === '') {
          onCommit(drawings.filter((drawing) => drawing.id !== id))
          setSelectedId(null)
        } else {
          onCommit(
            drawings.map((drawing) =>
              drawing.id === id && drawing.type === 'text'
                ? { ...drawing, options: { ...drawing.options, text: trimmed } }
                : drawing,
            ),
          )
        }
      } else if (trimmed.trim() !== '') {
        const id = newDrawingId()
        const note = { ...buildDrawing('text', [editing.anchor], id), options: { text: trimmed } }
        onCommit([...drawings, note as DrawingObject])
        setSelectedId(id)
      }
      setEditing(null)
      if (!editing.id && !keepTool) onToolChange('cursor')
    },
    [editing, drawings, onCommit, keepTool, onToolChange],
  )

  const cancelText = useCallback(() => {
    setEditing(null)
    if (editing && !editing.id && !keepTool) onToolChange('cursor')
  }, [editing, keepTool, onToolChange])

  const updateSelected = useCallback(
    (update: (drawing: DrawingObject) => DrawingObject) => {
      if (!selectedId) return
      onCommit(drawings.map((drawing) => (drawing.id === selectedId ? update(drawing) : drawing)))
    },
    [drawings, onCommit, selectedId],
  )

  const clearSelection = useCallback(() => setSelectedId(null), [])

  const selectedEntry = placed.find((entry) => entry.drawing.id === selectedId) ?? null

  const draft = useMemo<PlacedDrawing | null>(() => {
    if (!placing || !pointer) return null
    const pointerAnchor = anchorAtPoint(pointer, scene)
    const anchors = draftAnchors(placing.anchors, pointerAnchor, anchorCountFor(placing.tool))
    const drawing = buildDrawing(placing.tool, anchors, 'draft')
    const points = anchors.map((anchor) => pixelOfAnchor(anchor, scene))
    return { drawing, geometry: shapeGeometry(drawing, points, shapeContext) }
  }, [placing, pointer, scene, shapeContext])

  const cursor = (() => {
    if (tool !== 'cursor' || placing) return 'crosshair'
    if (gesture) return 'grabbing'
    if (hover?.kind === 'handle') return 'nwse-resize'
    if (hover?.kind === 'body') return 'move'
    return null
  })()

  return {
    placed,
    draft,
    selectedId: selectedEntry ? selectedId : null,
    selected: selectedEntry?.drawing ?? null,
    selectedGeometry: selectedEntry?.geometry ?? null,
    hoveredId: hover?.id ?? null,
    editing,
    cursor,
    isDragging: gesture !== null,
    press,
    move,
    release,
    leave,
    doubleClick,
    keyDown,
    commitText,
    cancelText,
    updateSelected,
    deleteSelected,
    clearSelection,
    startTextEdit: (id: string) => {
      const drawing = findDrawing(id)
      if (drawing && drawing.type === 'text') {
        setEditing({ id, anchor: drawing.anchors[0], text: drawing.options.text })
      }
    },
  }
}
