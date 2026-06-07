//! Native PDF backtest report generation.
//!
//! The frontend serializes a [`ReportPayload`] (config/specs, metrics, equity
//! curve, monthly stats and the full trade list) and invokes
//! [`generate_backtest_report`]. Everything below renders a polished, multi-page
//! A4 report entirely in Rust using `printpdf`, drawing the charts as native
//! vector graphics from the raw data series (no rasterization).

use std::io::BufWriter;

use printpdf::path::{PaintMode, WindingOrder};
use printpdf::{
    BuiltinFont, Color, IndirectFontRef, Line, Mm, PdfDocument, PdfDocumentReference,
    PdfLayerReference, Point, Polygon, Rect, Rgb,
};
use serde::Deserialize;

/// printpdf uses `f32` millimetres; our geometry is computed in `f64`.
#[inline]
fn mm(v: f64) -> Mm {
    Mm(v as f32)
}

// ---------------------------------------------------------------------------
// Payload (matches the camelCase JSON built on the frontend)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPayload {
    pub generated_at: String,
    pub config: ReportConfig,
    pub metrics: ReportMetrics,
    pub equity_curve: Vec<EquityPoint>,
    pub monthly_stats: Vec<MonthlyStat>,
    pub trades: Vec<TradeRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportConfig {
    pub symbol: String,
    pub timeframe: String,
    pub start: Option<String>,
    pub end: Option<String>,
    pub initial_capital: f64,
    pub point_value: Option<f64>,
    pub strategy: Option<String>,
    pub strategy_params: Vec<KeyValue>,
    pub position_sizing: Vec<KeyValue>,
}

#[derive(Debug, Deserialize)]
pub struct KeyValue {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ReportMetrics {
    pub total_trades: i64,
    pub total_pnl: f64,
    pub win_rate: f64,
    pub winning_trades: i64,
    pub losing_trades: i64,
    pub max_drawdown_value: f64,
    pub max_drawdown_pct: f64,
    pub profit_factor: f64,
    pub recovery_factor: f64,
    pub expectancy: f64,
    pub avg_win: f64,
    pub avg_loss: f64,
    pub win_loss_ratio: f64,
    pub max_consecutive_wins: i64,
    pub max_consecutive_losses: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EquityPoint {
    pub equity: f64,
    pub drawdown_pct: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyStat {
    pub label: String,
    pub pnl: f64,
    pub trades: i64,
    pub win_rate: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradeRow {
    pub symbol: String,
    pub action: String,
    pub quantity: f64,
    pub entry_time: String,
    pub entry_price: f64,
    pub exit_time: Option<String>,
    pub exit_price: Option<f64>,
    pub pnl: Option<f64>,
}

// ---------------------------------------------------------------------------
// Palette & page geometry
// ---------------------------------------------------------------------------

const PAGE_W: f64 = 210.0;
const PAGE_H: f64 = 297.0;
const MARGIN: f64 = 18.0;
const CONTENT_W: f64 = PAGE_W - 2.0 * MARGIN;
const TOP: f64 = 20.0; // first content baseline offset from top
const BOTTOM_LIMIT: f64 = PAGE_H - 16.0; // y-from-top past which we paginate

fn rgb(r: u8, g: u8, b: u8) -> Color {
    Color::Rgb(Rgb::new(
        r as f32 / 255.0,
        g as f32 / 255.0,
        b as f32 / 255.0,
        None,
    ))
}

fn ink() -> Color {
    rgb(26, 28, 32)
}
fn muted() -> Color {
    rgb(111, 119, 133)
}
fn brass() -> Color {
    rgb(196, 165, 116)
}
fn positive() -> Color {
    rgb(34, 160, 90)
}
fn negative() -> Color {
    rgb(200, 60, 60)
}
fn grid() -> Color {
    rgb(222, 226, 232)
}
fn panel() -> Color {
    rgb(245, 246, 248)
}
fn white() -> Color {
    rgb(255, 255, 255)
}

// ---------------------------------------------------------------------------
// Document builder with a top-down cursor and automatic pagination
// ---------------------------------------------------------------------------

struct Doc {
    doc: PdfDocumentReference,
    regular: IndirectFontRef,
    bold: IndirectFontRef,
    pages: Vec<(printpdf::PdfPageIndex, printpdf::PdfLayerIndex)>,
    cursor: f64, // mm from top of the current page
}

impl Doc {
    fn new(title: &str) -> Self {
        let (doc, page, layer) = PdfDocument::new(title, mm(PAGE_W), mm(PAGE_H), "Layer 1");
        let regular = doc.add_builtin_font(BuiltinFont::Helvetica).unwrap();
        let bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).unwrap();
        Self {
            doc,
            regular,
            bold,
            pages: vec![(page, layer)],
            cursor: TOP,
        }
    }

    fn layer(&self) -> PdfLayerReference {
        let (p, l) = *self.pages.last().unwrap();
        self.doc.get_page(p).get_layer(l)
    }

    fn new_page(&mut self) {
        let (p, l) = self.doc.add_page(mm(PAGE_W), mm(PAGE_H), "Layer 1");
        self.pages.push((p, l));
        self.cursor = TOP;
    }

    /// Ensure `need` mm of vertical space remain; otherwise start a new page.
    fn ensure(&mut self, need: f64) {
        if self.cursor + need > BOTTOM_LIMIT {
            self.new_page();
        }
    }

    fn y(&self) -> f64 {
        PAGE_H - self.cursor
    }

    fn font(&self, bold: bool) -> &IndirectFontRef {
        if bold {
            &self.bold
        } else {
            &self.regular
        }
    }

    /// Draw text with its baseline at the current cursor, left edge at `x` (mm).
    fn text_at(&self, x: f64, size: f32, bold: bool, color: Color, s: &str) {
        let layer = self.layer();
        layer.set_fill_color(color);
        layer.use_text(s, size, mm(x), mm(self.y()), self.font(bold));
    }

    /// Right-aligned text whose right edge sits at `right` (mm).
    fn text_right(&self, right: f64, size: f32, bold: bool, color: Color, s: &str) {
        let w = text_width(s, size, bold);
        self.text_at(right - w, size, bold, color, s);
    }

    fn advance(&mut self, dy: f64) {
        self.cursor += dy;
    }

    fn rect(&self, x: f64, y_top: f64, w: f64, h: f64, fill: Option<Color>, stroke: Option<Color>) {
        let layer = self.layer();
        let mode = match (fill.is_some(), stroke.is_some()) {
            (true, true) => PaintMode::FillStroke,
            (true, false) => PaintMode::Fill,
            (false, true) => PaintMode::Stroke,
            (false, false) => return,
        };
        if let Some(c) = fill {
            layer.set_fill_color(c);
        }
        if let Some(c) = stroke {
            layer.set_outline_color(c);
            layer.set_outline_thickness(0.5);
        }
        let bottom = PAGE_H - (y_top + h);
        let r = Rect::new(mm(x), mm(bottom), mm(x + w), mm(bottom + h)).with_mode(mode);
        layer.add_rect(r);
    }

    fn hline(&self, x0: f64, x1: f64, y_top: f64, color: Color, thickness: f32) {
        let layer = self.layer();
        layer.set_outline_color(color);
        layer.set_outline_thickness(thickness);
        let y = PAGE_H - y_top;
        let line = Line {
            points: vec![
                (Point::new(mm(x0), mm(y)), false),
                (Point::new(mm(x1), mm(y)), false),
            ],
            is_closed: false,
        };
        layer.add_line(line);
    }

    fn finish(self) -> Result<Vec<u8>, String> {
        // Footer with page numbers, drawn once the total is known.
        let total = self.pages.len();
        for (i, (p, l)) in self.pages.iter().enumerate() {
            let layer = self.doc.get_page(*p).get_layer(*l);
            layer.set_fill_color(muted());
            let label = format!("Quant — Backtest Report     Page {} of {}", i + 1, total);
            layer.use_text(&label, 7.5, mm(MARGIN), mm(8.0), &self.regular);
        }
        self.doc
            .save_to_bytes()
            .map_err(|e| format!("failed to serialize PDF: {e}"))
    }
}

// ---------------------------------------------------------------------------
// Approximate Helvetica text width (mm) — good enough for layout/alignment
// ---------------------------------------------------------------------------

fn text_width(s: &str, size: f32, bold: bool) -> f64 {
    let factor = if bold { 0.55 } else { 0.52 };
    // 1 pt = 0.352778 mm
    (s.chars().count() as f64) * (size as f64) * factor * 0.352778
}

fn truncate_to(s: &str, max_w: f64, size: f32, bold: bool) -> String {
    if text_width(s, size, bold) <= max_w {
        return s.to_string();
    }
    let mut out = String::new();
    for ch in s.chars() {
        let candidate = format!("{out}{ch}…");
        if text_width(&candidate, size, bold) > max_w {
            break;
        }
        out.push(ch);
    }
    format!("{out}…")
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

fn fmt_thousands(int_part: &str) -> String {
    let neg = int_part.starts_with('-');
    let digits = int_part.trim_start_matches('-');
    let mut out = String::new();
    let len = digits.len();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    if neg {
        format!("-{out}")
    } else {
        out
    }
}

fn fmt_currency(v: f64) -> String {
    let s = format!("{:.2}", v.abs());
    let (int, frac) = s.split_once('.').unwrap_or((s.as_str(), "00"));
    let sign = if v < 0.0 { "-" } else { "" };
    format!("{sign}{}.{frac}", fmt_thousands(int))
}

fn fmt_signed_currency(v: f64) -> String {
    let s = format!("{:.2}", v.abs());
    let (int, frac) = s.split_once('.').unwrap_or((s.as_str(), "00"));
    let sign = if v > 0.0 {
        "+"
    } else if v < 0.0 {
        "-"
    } else {
        ""
    };
    format!("{sign}{}.{frac}", fmt_thousands(int))
}

fn fmt_pct(v: f64) -> String {
    format!("{:.2}%", v * 100.0)
}

fn fmt_num(v: f64) -> String {
    format!("{v:.2}")
}

fn pnl_color(v: f64) -> Color {
    if v >= 0.0 {
        positive()
    } else {
        negative()
    }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

fn section_title(doc: &mut Doc, title: &str) {
    doc.ensure(16.0);
    doc.advance(4.0);
    doc.text_at(MARGIN, 12.0, true, ink(), title);
    doc.advance(3.0);
    doc.hline(MARGIN, PAGE_W - MARGIN, doc.cursor, brass(), 0.8);
    doc.advance(6.0);
}

fn draw_header(doc: &mut Doc, p: &ReportPayload) {
    // Brand band
    doc.rect(0.0, 0.0, PAGE_W, 14.0, Some(rgb(24, 27, 31)), None);
    doc.cursor = 9.5;
    doc.text_at(MARGIN, 13.0, true, brass(), "QUANT");
    doc.text_right(
        PAGE_W - MARGIN,
        9.0,
        false,
        rgb(170, 176, 186),
        "Backtest Performance Report",
    );

    doc.cursor = 24.0;
    let title = format!("{} · {}", p.config.symbol, p.config.timeframe);
    doc.text_at(MARGIN, 22.0, true, ink(), &title);
    doc.advance(8.0);

    let strat = p.config.strategy.as_deref().unwrap_or("—");
    doc.text_at(MARGIN, 10.0, false, muted(), &format!("Strategy: {strat}"));
    doc.advance(5.5);
    doc.text_at(
        MARGIN,
        9.0,
        false,
        muted(),
        &format!("Generated {}", p.generated_at),
    );
    doc.advance(4.0);
}

fn draw_specs(doc: &mut Doc, p: &ReportPayload) {
    section_title(doc, "Configuration & Specifications");

    let mut rows: Vec<(String, String)> = Vec::new();
    rows.push(("Symbol".into(), p.config.symbol.clone()));
    rows.push(("Timeframe".into(), p.config.timeframe.clone()));
    if let Some(start) = &p.config.start {
        let end = p.config.end.as_deref().unwrap_or("—");
        rows.push(("Period".into(), format!("{start}  →  {end}")));
    }
    rows.push((
        "Initial Capital".into(),
        fmt_currency(p.config.initial_capital),
    ));
    if let Some(pv) = p.config.point_value {
        rows.push(("Point Value".into(), fmt_num(pv)));
    }
    if let Some(strat) = &p.config.strategy {
        rows.push(("Strategy".into(), strat.clone()));
    }
    for kv in &p.config.strategy_params {
        rows.push((kv.label.clone(), kv.value.clone()));
    }
    for kv in &p.config.position_sizing {
        rows.push((kv.label.clone(), kv.value.clone()));
    }

    // Two-column key/value grid.
    let col_w = CONTENT_W / 2.0;
    let row_h = 7.0;
    let n = rows.len();
    let per_col = n.div_ceil(2);
    doc.ensure(per_col as f64 * row_h + 2.0);
    let top = doc.cursor;
    for (i, (k, v)) in rows.iter().enumerate() {
        let col = i / per_col;
        let row = i % per_col;
        let x = MARGIN + col as f64 * col_w;
        let y = top + row as f64 * row_h;
        if row % 2 == 0 {
            doc.rect(x, y - 1.5, col_w - 4.0, row_h, Some(panel()), None);
        }
        doc.cursor = y + 3.5;
        doc.text_at(x + 2.0, 8.5, false, muted(), k);
        doc.text_right(x + col_w - 6.0, 8.5, true, ink(), v);
    }
    doc.cursor = top + per_col as f64 * row_h;
    doc.advance(2.0);
}

fn draw_summary(doc: &mut Doc, m: &ReportMetrics) {
    section_title(doc, "Executive Summary");

    let cards: [(&str, String, Color); 4] = [
        ("Total PnL", fmt_signed_currency(m.total_pnl), pnl_color(m.total_pnl)),
        ("Win Rate", fmt_pct(m.win_rate), ink()),
        ("Profit Factor", fmt_num(m.profit_factor), ink()),
        (
            "Max Drawdown",
            format!("-{}", fmt_pct(m.max_drawdown_pct).trim_start_matches('-')),
            negative(),
        ),
    ];

    let gap = 4.0;
    let card_w = (CONTENT_W - gap * 3.0) / 4.0;
    let card_h = 22.0;
    doc.ensure(card_h + 2.0);
    let top = doc.cursor;
    for (i, (label, value, color)) in cards.iter().enumerate() {
        let x = MARGIN + i as f64 * (card_w + gap);
        doc.rect(x, top, card_w, card_h, Some(panel()), Some(grid()));
        doc.cursor = top + 7.0;
        doc.text_at(x + 4.0, 8.0, false, muted(), label);
        doc.cursor = top + 16.0;
        doc.text_at(x + 4.0, 15.0, true, color.clone(), value);
    }
    doc.cursor = top + card_h;
    doc.advance(2.0);
}

fn metric_table(doc: &mut Doc, title: &str, rows: &[(String, String, Option<Color>)]) {
    let row_h = 7.0;
    doc.ensure(8.0 + rows.len() as f64 * row_h);
    doc.text_at(MARGIN, 9.5, true, brass(), title);
    doc.advance(6.0);
    let top = doc.cursor;
    for (i, (k, v, color)) in rows.iter().enumerate() {
        let y = top + i as f64 * row_h;
        if i % 2 == 0 {
            doc.rect(MARGIN, y - 1.5, CONTENT_W, row_h, Some(panel()), None);
        }
        doc.cursor = y + 3.5;
        doc.text_at(MARGIN + 2.0, 9.0, false, muted(), k);
        doc.text_right(PAGE_W - MARGIN - 3.0, 9.0, true, color.clone().unwrap_or(ink()), v);
    }
    doc.cursor = top + rows.len() as f64 * row_h;
    doc.advance(4.0);
}

fn draw_metrics(doc: &mut Doc, m: &ReportMetrics) {
    section_title(doc, "Detailed Metrics");

    metric_table(
        doc,
        "Returns",
        &[
            ("Total PnL".into(), fmt_signed_currency(m.total_pnl), Some(pnl_color(m.total_pnl))),
            ("Expectancy (per trade)".into(), fmt_signed_currency(m.expectancy), Some(pnl_color(m.expectancy))),
            ("Profit Factor".into(), fmt_num(m.profit_factor), None),
            ("Recovery Factor".into(), fmt_num(m.recovery_factor), None),
        ],
    );

    metric_table(
        doc,
        "Risk",
        &[
            ("Max Drawdown".into(), fmt_currency(m.max_drawdown_value), Some(negative())),
            ("Max Drawdown %".into(), format!("-{}", fmt_pct(m.max_drawdown_pct).trim_start_matches('-')), Some(negative())),
        ],
    );

    metric_table(
        doc,
        "Trade Quality",
        &[
            ("Total Trades".into(), m.total_trades.to_string(), None),
            ("Winning Trades".into(), m.winning_trades.to_string(), Some(positive())),
            ("Losing Trades".into(), m.losing_trades.to_string(), Some(negative())),
            ("Win Rate".into(), fmt_pct(m.win_rate), None),
            ("Average Win".into(), fmt_signed_currency(m.avg_win), Some(positive())),
            ("Average Loss".into(), fmt_signed_currency(-m.avg_loss.abs()), Some(negative())),
            ("Win / Loss Ratio".into(), fmt_num(m.win_loss_ratio), None),
        ],
    );

    metric_table(
        doc,
        "Streaks",
        &[
            ("Max Consecutive Wins".into(), m.max_consecutive_wins.to_string(), Some(positive())),
            ("Max Consecutive Losses".into(), m.max_consecutive_losses.to_string(), Some(negative())),
        ],
    );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/// Downsample a series to at most `max` points, preserving first/last.
fn downsample(values: &[f64], max: usize) -> Vec<f64> {
    if values.len() <= max || values.is_empty() {
        return values.to_vec();
    }
    let step = values.len() as f64 / max as f64;
    let mut out = Vec::with_capacity(max);
    for i in 0..max {
        let idx = (i as f64 * step) as usize;
        out.push(values[idx.min(values.len() - 1)]);
    }
    out
}

struct ChartBox {
    x: f64,
    y_top: f64,
    w: f64,
    h: f64,
}

impl ChartBox {
    fn px(&self, i: usize, n: usize) -> f64 {
        if n <= 1 {
            self.x
        } else {
            self.x + (i as f64 / (n - 1) as f64) * self.w
        }
    }
    fn py(&self, v: f64, lo: f64, hi: f64) -> f64 {
        // returns y-from-top in mm
        if (hi - lo).abs() < f64::EPSILON {
            return self.y_top + self.h / 2.0;
        }
        let t = (v - lo) / (hi - lo);
        self.y_top + self.h - t * self.h
    }
}

fn draw_line_series(doc: &Doc, b: &ChartBox, vals: &[f64], lo: f64, hi: f64, color: Color, thick: f32) {
    if vals.len() < 2 {
        return;
    }
    let layer = doc.layer();
    layer.set_outline_color(color);
    layer.set_outline_thickness(thick);
    let pts: Vec<(Point, bool)> = vals
        .iter()
        .enumerate()
        .map(|(i, v)| {
            let x = b.px(i, vals.len());
            let y = PAGE_H - b.py(*v, lo, hi);
            (Point::new(mm(x), mm(y)), false)
        })
        .collect();
    layer.add_line(Line {
        points: pts,
        is_closed: false,
    });
}

fn chart_frame(doc: &mut Doc, b: &ChartBox, lo: f64, hi: f64, lo_label: &str, hi_label: &str) {
    // background + border
    doc.rect(b.x, b.y_top, b.w, b.h, Some(white()), Some(grid()));
    // 4 horizontal gridlines + value labels
    for i in 0..=4 {
        let t = i as f64 / 4.0;
        let y = b.y_top + b.h - t * b.h;
        doc.hline(b.x, b.x + b.w, y, grid(), 0.3);
        let val = lo + t * (hi - lo);
        doc.cursor = y + 1.5;
        doc.text_at(b.x + b.w + 1.5, 6.5, false, muted(), &fmt_compact(val));
    }
    let _ = (lo_label, hi_label);
}

fn fmt_compact(v: f64) -> String {
    let a = v.abs();
    if a >= 1_000_000.0 {
        format!("{:.1}M", v / 1_000_000.0)
    } else if a >= 1_000.0 {
        format!("{:.0}k", v / 1_000.0)
    } else {
        format!("{v:.0}")
    }
}

fn draw_equity_chart(doc: &mut Doc, p: &ReportPayload) {
    section_title(doc, "Equity Curve & Drawdown");

    let equity: Vec<f64> = downsample(
        &p.equity_curve.iter().map(|e| e.equity).collect::<Vec<_>>(),
        600,
    );
    let dd: Vec<f64> = downsample(
        &p.equity_curve
            .iter()
            .map(|e| e.drawdown_pct * 100.0)
            .collect::<Vec<_>>(),
        600,
    );

    if equity.len() < 2 {
        doc.text_at(MARGIN, 9.0, false, muted(), "Not enough data to plot the equity curve.");
        doc.advance(8.0);
        return;
    }

    // --- Equity ---
    let eq_h = 62.0;
    let label_pad = 14.0;
    doc.ensure(eq_h + 10.0);
    let b = ChartBox {
        x: MARGIN,
        y_top: doc.cursor,
        w: CONTENT_W - label_pad,
        h: eq_h,
    };
    let mut lo = equity.iter().cloned().fold(f64::INFINITY, f64::min);
    let mut hi = equity.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    // include the initial capital reference and pad the range
    lo = lo.min(p.config.initial_capital);
    hi = hi.max(p.config.initial_capital);
    let pad = (hi - lo) * 0.08 + 1.0;
    lo -= pad;
    hi += pad;
    chart_frame(doc, &b, lo, hi, "", "");

    // initial-capital baseline (dashed look via thin line)
    let base_y = b.py(p.config.initial_capital, lo, hi);
    doc.hline(b.x, b.x + b.w, base_y, muted(), 0.4);

    draw_line_series(doc, &b, &equity, lo, hi, brass(), 1.2);
    doc.cursor = b.y_top + b.h + 5.0;
    doc.text_at(b.x, 7.5, false, muted(), "Account equity over the backtest period");
    doc.advance(6.0);

    // --- Drawdown ---
    let dd_h = 40.0;
    doc.ensure(dd_h + 10.0);
    let b2 = ChartBox {
        x: MARGIN,
        y_top: doc.cursor,
        w: CONTENT_W - label_pad,
        h: dd_h,
    };
    let dd_lo = dd.iter().cloned().fold(0.0_f64, f64::min);
    let dd_hi = 0.0_f64;
    let dd_lo = dd_lo - (dd_lo.abs() * 0.1 + 0.5);
    // frame with % labels
    doc.rect(b2.x, b2.y_top, b2.w, b2.h, Some(white()), Some(grid()));
    for i in 0..=2 {
        let t = i as f64 / 2.0;
        let y = b2.y_top + b2.h - t * b2.h;
        doc.hline(b2.x, b2.x + b2.w, y, grid(), 0.3);
        let val = dd_lo + t * (dd_hi - dd_lo);
        doc.cursor = y + 1.5;
        doc.text_at(b2.x + b2.w + 1.5, 6.5, false, muted(), &format!("{val:.1}%"));
    }

    // filled drawdown area
    if dd.len() >= 2 {
        let layer = doc.layer();
        let mut ring: Vec<(Point, bool)> = Vec::with_capacity(dd.len() + 2);
        ring.push((Point::new(mm(b2.x), mm(PAGE_H - b2.py(0.0, dd_lo, dd_hi))), false));
        for (i, v) in dd.iter().enumerate() {
            let x = b2.px(i, dd.len());
            let y = PAGE_H - b2.py(*v, dd_lo, dd_hi);
            ring.push((Point::new(mm(x), mm(y)), false));
        }
        ring.push((
            Point::new(mm(b2.x + b2.w), mm(PAGE_H - b2.py(0.0, dd_lo, dd_hi))),
            false,
        ));
        layer.set_fill_color(rgb(245, 215, 215));
        layer.add_polygon(Polygon {
            rings: vec![ring],
            mode: PaintMode::Fill,
            winding_order: WindingOrder::NonZero,
        });
    }
    draw_line_series(doc, &b2, &dd, dd_lo, dd_hi, negative(), 1.0);
    doc.cursor = b2.y_top + b2.h + 5.0;
    doc.text_at(b2.x, 7.5, false, muted(), "Drawdown from peak equity (%)");
    doc.advance(6.0);
}

fn draw_monthly(doc: &mut Doc, p: &ReportPayload) {
    if p.monthly_stats.is_empty() {
        return;
    }
    section_title(doc, "Monthly Performance");

    // --- Bar chart ---
    let h = 50.0;
    let label_pad = 14.0;
    doc.ensure(h + 14.0);
    let b = ChartBox {
        x: MARGIN,
        y_top: doc.cursor,
        w: CONTENT_W - label_pad,
        h,
    };
    let max_abs = p
        .monthly_stats
        .iter()
        .map(|m| m.pnl.abs())
        .fold(0.0_f64, f64::max)
        .max(1.0);
    let lo = -max_abs * 1.1;
    let hi = max_abs * 1.1;
    doc.rect(b.x, b.y_top, b.w, b.h, Some(white()), Some(grid()));
    // zero line + labels
    let zero_y = b.py(0.0, lo, hi);
    doc.hline(b.x, b.x + b.w, zero_y, muted(), 0.4);
    for (i, lbl) in [(0usize, hi), (1, 0.0), (2, lo)] {
        let _ = i;
        let y = b.py(lbl, lo, hi);
        doc.cursor = y + 1.5;
        doc.text_at(b.x + b.w + 1.5, 6.5, false, muted(), &fmt_compact(lbl));
    }

    let n = p.monthly_stats.len();
    let slot = b.w / n as f64;
    let bar_w = (slot * 0.6).min(10.0);
    for (i, m) in p.monthly_stats.iter().enumerate() {
        let cx = b.x + (i as f64 + 0.5) * slot;
        let y_val = b.py(m.pnl, lo, hi);
        let (y_top, bh) = if m.pnl >= 0.0 {
            (y_val, zero_y - y_val)
        } else {
            (zero_y, y_val - zero_y)
        };
        if bh > 0.05 {
            doc.rect(cx - bar_w / 2.0, y_top, bar_w, bh, Some(pnl_color(m.pnl)), None);
        }
    }
    doc.cursor = b.y_top + b.h + 5.0;
    doc.text_at(b.x, 7.5, false, muted(), "Net PnL by month");
    doc.advance(8.0);

    // --- Breakdown table ---
    let headers = ["Month", "PnL", "Trades", "Win Rate"];
    let cols = [MARGIN + 2.0, MARGIN + 70.0, MARGIN + 110.0, MARGIN + 150.0];
    let right = PAGE_W - MARGIN - 3.0;
    doc.ensure(10.0);
    doc.rect(MARGIN, doc.cursor - 1.5, CONTENT_W, 7.0, Some(rgb(232, 234, 238)), None);
    doc.cursor += 3.5;
    doc.text_at(cols[0], 8.0, true, ink(), headers[0]);
    doc.text_right(MARGIN + 100.0, 8.0, true, ink(), headers[1]);
    doc.text_right(MARGIN + 135.0, 8.0, true, ink(), headers[2]);
    doc.text_right(right, 8.0, true, ink(), headers[3]);
    doc.advance(3.5);

    let row_h = 6.5;
    for (i, m) in p.monthly_stats.iter().enumerate() {
        doc.ensure(row_h + 2.0);
        let y = doc.cursor;
        if i % 2 == 0 {
            doc.rect(MARGIN, y - 1.5, CONTENT_W, row_h, Some(panel()), None);
        }
        doc.cursor = y + 3.0;
        doc.text_at(cols[0], 8.0, false, ink(), &m.label);
        doc.text_right(MARGIN + 100.0, 8.0, false, pnl_color(m.pnl), &fmt_signed_currency(m.pnl));
        doc.text_right(MARGIN + 135.0, 8.0, false, ink(), &m.trades.to_string());
        doc.text_right(right, 8.0, false, ink(), &fmt_pct(m.win_rate));
        doc.cursor = y + row_h;
        let _ = cols;
    }
    doc.advance(2.0);
}

fn draw_trades(doc: &mut Doc, p: &ReportPayload) {
    section_title(doc, &format!("Trade List ({} trades)", p.trades.len()));

    // column right-edges (mm)
    let c_sym = MARGIN + 2.0;
    let c_act = MARGIN + 26.0;
    let c_qty_r = MARGIN + 56.0;
    let c_entry_t = MARGIN + 60.0;
    let c_entry_p_r = MARGIN + 110.0;
    let c_exit_t = MARGIN + 114.0;
    let c_exit_p_r = MARGIN + 158.0;
    let c_pnl_r = PAGE_W - MARGIN - 3.0;
    let row_h = 6.0;

    let header = |doc: &mut Doc| {
        doc.ensure(9.0);
        doc.rect(MARGIN, doc.cursor - 1.5, CONTENT_W, 7.0, Some(rgb(232, 234, 238)), None);
        doc.cursor += 3.5;
        doc.text_at(c_sym, 7.5, true, ink(), "Symbol");
        doc.text_at(c_act, 7.5, true, ink(), "Side");
        doc.text_right(c_qty_r, 7.5, true, ink(), "Qty");
        doc.text_at(c_entry_t, 7.5, true, ink(), "Entry");
        doc.text_right(c_entry_p_r, 7.5, true, ink(), "Price");
        doc.text_at(c_exit_t, 7.5, true, ink(), "Exit");
        doc.text_right(c_exit_p_r, 7.5, true, ink(), "Price");
        doc.text_right(c_pnl_r, 7.5, true, ink(), "PnL");
        doc.advance(3.5);
    };

    if p.trades.is_empty() {
        doc.text_at(MARGIN, 9.0, false, muted(), "No trades were executed in this backtest.");
        return;
    }

    header(doc);
    let mut shade = 0usize;
    for t in &p.trades {
        if doc.cursor + row_h > BOTTOM_LIMIT {
            doc.new_page();
            header(doc);
            shade = 0;
        }
        let y = doc.cursor;
        if shade % 2 == 0 {
            doc.rect(MARGIN, y - 1.5, CONTENT_W, row_h, Some(panel()), None);
        }
        shade += 1;
        doc.cursor = y + 3.0;

        let action_color = if t.action.eq_ignore_ascii_case("BUY") {
            positive()
        } else {
            negative()
        };
        doc.text_at(c_sym, 7.0, false, ink(), &truncate_to(&t.symbol, 22.0, 7.0, false));
        doc.text_at(c_act, 7.0, true, action_color, &t.action);
        doc.text_right(c_qty_r, 7.0, false, ink(), &fmt_qty(t.quantity));
        doc.text_at(c_entry_t, 7.0, false, ink(), &truncate_to(&t.entry_time, 48.0, 7.0, false));
        doc.text_right(c_entry_p_r, 7.0, false, ink(), &fmt_currency(t.entry_price));
        let exit_t = t.exit_time.as_deref().unwrap_or("—");
        doc.text_at(c_exit_t, 7.0, false, ink(), &truncate_to(exit_t, 42.0, 7.0, false));
        let exit_p = t.exit_price.map(fmt_currency).unwrap_or_else(|| "—".into());
        doc.text_right(c_exit_p_r, 7.0, false, ink(), &exit_p);
        match t.pnl {
            Some(v) => doc.text_right(c_pnl_r, 7.0, true, pnl_color(v), &fmt_signed_currency(v)),
            None => doc.text_right(c_pnl_r, 7.0, false, muted(), "—"),
        }
        doc.cursor = y + row_h;
    }
}

fn fmt_qty(q: f64) -> String {
    if (q.fract()).abs() < f64::EPSILON {
        format!("{}", q as i64)
    } else {
        format!("{q:.2}")
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub fn build_pdf(payload: &ReportPayload) -> Result<Vec<u8>, String> {
    let mut doc = Doc::new("Quant Backtest Report");
    draw_header(&mut doc, payload);
    draw_specs(&mut doc, payload);
    draw_summary(&mut doc, &payload.metrics);
    draw_metrics(&mut doc, &payload.metrics);
    draw_equity_chart(&mut doc, payload);
    draw_monthly(&mut doc, payload);
    draw_trades(&mut doc, payload);
    doc.finish()
}

/// Tauri command: render the report, prompt for a save location with a native
/// dialog, and write the PDF there. Returns the saved path, or `None` if the
/// user cancelled the dialog.
#[tauri::command]
pub async fn generate_backtest_report(
    app: tauri::AppHandle,
    payload: ReportPayload,
    default_file_name: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    // Render first so a render error surfaces before the dialog opens.
    let bytes = build_pdf(&payload)?;

    let file_name = default_file_name.unwrap_or_else(|| "backtest-report.pdf".to_string());
    let chosen = app
        .dialog()
        .file()
        .add_filter("PDF Document", &["pdf"])
        .set_file_name(file_name)
        .blocking_save_file();

    let Some(file_path) = chosen else {
        return Ok(None);
    };
    let path = file_path
        .into_path()
        .map_err(|e| format!("invalid save path: {e}"))?;

    let file = std::fs::File::create(&path).map_err(|e| format!("failed to create file: {e}"))?;
    let mut writer = BufWriter::new(file);
    use std::io::Write;
    writer
        .write_all(&bytes)
        .map_err(|e| format!("failed to write PDF: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("failed to flush PDF: {e}"))?;

    Ok(Some(path.display().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_metrics() -> ReportMetrics {
        ReportMetrics {
            total_trades: 42,
            total_pnl: 12345.67,
            win_rate: 0.561,
            winning_trades: 24,
            losing_trades: 18,
            max_drawdown_value: 3210.5,
            max_drawdown_pct: 0.1234,
            profit_factor: 1.85,
            recovery_factor: 2.1,
            expectancy: 293.9,
            avg_win: 800.0,
            avg_loss: 450.0,
            win_loss_ratio: 1.78,
            max_consecutive_wins: 6,
            max_consecutive_losses: 3,
        }
    }

    pub(super) fn payload(n_trades: usize, n_points: usize, n_months: usize) -> ReportPayload {
        let mut equity_curve = Vec::new();
        let mut eq = 100_000.0;
        for i in 0..n_points {
            eq += ((i as f64 * 0.7).sin()) * 500.0;
            equity_curve.push(EquityPoint {
                equity: eq,
                drawdown_pct: -((i as f64 * 0.3).cos().abs()) * 0.1,
            });
        }
        let monthly_stats = (0..n_months)
            .map(|i| MonthlyStat {
                label: format!("2024/{:02}", i + 1),
                pnl: if i % 2 == 0 { 1500.0 } else { -800.0 },
                trades: 5,
                win_rate: 0.6,
            })
            .collect();
        let trades = (0..n_trades)
            .map(|i| TradeRow {
                symbol: "PETR4".into(),
                action: if i % 2 == 0 { "BUY".into() } else { "SELL".into() },
                quantity: 100.0,
                entry_time: "2024/01/15 10:30:00".into(),
                entry_price: 32.5 + i as f64 * 0.01,
                exit_time: Some("2024/01/16 11:00:00".into()),
                exit_price: Some(33.1),
                pnl: Some(if i % 3 == 0 { -120.0 } else { 240.0 }),
            })
            .collect();

        ReportPayload {
            generated_at: "2024/06/07 12:00:00".into(),
            config: ReportConfig {
                symbol: "PETR4".into(),
                timeframe: "D1".into(),
                start: Some("2024/01/01".into()),
                end: Some("2024/06/01".into()),
                initial_capital: 100_000.0,
                point_value: Some(1.0),
                strategy: Some("MACrossover".into()),
                strategy_params: vec![
                    KeyValue { label: "Short Period".into(), value: "50".into() },
                    KeyValue { label: "Long Period".into(), value: "200".into() },
                ],
                position_sizing: vec![KeyValue {
                    label: "Position Sizing".into(),
                    value: "Fixed Quantity".into(),
                }],
            },
            metrics: sample_metrics(),
            equity_curve,
            monthly_stats,
            trades,
        }
    }

    #[test]
    fn builds_valid_pdf() {
        let bytes = build_pdf(&payload(120, 2000, 12)).expect("pdf should build");
        assert!(bytes.len() > 1000, "pdf unexpectedly small");
        assert_eq!(&bytes[0..4], b"%PDF", "missing PDF header");
    }

    #[test]
    fn handles_empty_results() {
        let bytes = build_pdf(&payload(0, 0, 0)).expect("pdf should build with no data");
        assert_eq!(&bytes[0..4], b"%PDF");
    }

    #[test]
    fn currency_formatting() {
        assert_eq!(fmt_currency(1234567.5), "1,234,567.50");
        assert_eq!(fmt_signed_currency(1234.0), "+1,234.00");
        assert_eq!(fmt_signed_currency(-50.0), "-50.00");
        assert_eq!(fmt_pct(0.1234), "12.34%");
    }
}
