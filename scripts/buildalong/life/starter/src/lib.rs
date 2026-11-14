//! Conway's Game of Life.
//!
//! A grid of cells, each alive or dead. Every generation, a live cell with two or three live
//! neighbours stays alive, a dead cell with exactly three comes alive, and every other cell
//! is dead in the next generation.
//!
//! Each `todo!()` is yours to replace. Build one milestone at a time and check it with
//! `cargo test --test milestones m1_` (then `m2_`, `m3_`…).

// The stubs don't use their arguments, imports or fields yet. Delete this line once every todo!() is gone.
#![allow(unused_variables, unused_imports, dead_code)]

use std::fmt;

/// Why a picture of a grid couldn't be read. Lines are counted from 1.
#[derive(Debug, PartialEq)]
pub enum ParseError {
    /// No rows at all.
    Empty,
    /// This row isn't as wide as the first one.
    Ragged { line: usize },
    /// A character other than `#` (alive) or `.` (dead).
    BadChar { line: usize, ch: char },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Grid {
    width: usize,
    height: usize,
    /// Row by row: the cell at (x, y) is `cells[y * width + x]`.
    cells: Vec<bool>,
    /// Milestone 6: whether the edges wrap around.
    wrap: bool,
}

impl Grid {
    /// Milestone 1: a grid of dead cells that doesn't wrap.
    pub fn new(width: usize, height: usize) -> Grid {
        todo!()
    }

    /// Milestone 1
    pub fn width(&self) -> usize {
        todo!()
    }

    /// Milestone 1
    pub fn height(&self) -> usize {
        todo!()
    }

    /// Milestone 1: is the cell at column `x`, row `y` alive? Outside the grid is dead.
    pub fn get(&self, x: usize, y: usize) -> bool {
        todo!()
    }

    /// Milestone 1: sets a cell. Setting a cell outside the grid does nothing.
    pub fn set(&mut self, x: usize, y: usize, alive: bool) {
        todo!()
    }

    /// Milestone 1: how many cells are alive.
    pub fn population(&self) -> usize {
        todo!()
    }

    /// Milestone 2: reads a picture like
    ///
    /// ```text
    /// .#.
    /// .#.
    /// .#.
    /// ```
    ///
    /// `#` is alive, `.` is dead. Spaces around a row and blank lines are ignored.
    pub fn parse(s: &str) -> Result<Grid, ParseError> {
        todo!()
    }

    /// Milestone 4: how many of the eight cells around (x, y) are alive. Milestone 6: when the
    /// grid wraps, the left edge's neighbours include the right edge, and the top's the bottom.
    pub fn live_neighbours(&self, x: usize, y: usize) -> usize {
        todo!()
    }

    /// Milestone 5: the next generation, as a new grid. Count every cell's neighbours on the
    /// current grid (`self`) before you change anything.
    pub fn step(&self) -> Grid {
        todo!()
    }

    /// Milestone 6: the same grid, with wrapping edges turned on or off.
    pub fn with_wrap(self, wrap: bool) -> Grid {
        todo!()
    }

    /// Milestone 7: the smallest number of steps `p` (1 ≤ p ≤ `max`) after which the grid is
    /// exactly as it is now, or `None`. A still life has period 1, a blinker 2.
    pub fn period(&self, max: usize) -> Option<usize> {
        todo!()
    }
}

impl fmt::Display for Grid {
    /// Milestone 3: the same picture `parse` reads: `#` and `.`, rows separated by `\n`,
    /// no `\n` after the last row.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!()
    }
}
