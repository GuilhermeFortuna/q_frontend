import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/Menu'

describe('Menu', () => {
  it('opens items and supports destructive tone', async () => {
    const user = userEvent.setup()

    render(
      <Menu>
        <MenuTrigger asChild>
          <button type="button">Open menu</button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem>Rename</MenuItem>
          <MenuItem destructive>Delete</MenuItem>
        </MenuContent>
      </Menu>,
    )

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByText('Rename')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('text-rose-400')
  })

  it('renders submenu content', async () => {
    const user = userEvent.setup()

    render(
      <Menu>
        <MenuTrigger asChild>
          <button type="button">Actions</button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem>Duplicate</MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger>Export</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem>JSON</MenuItem>
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>,
    )

    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await user.hover(await screen.findByText('Export'))
    expect(await screen.findByText('JSON')).toBeInTheDocument()
  })
})
