//! Conway's Game of Life.
//! Reference solution for the `life` build-along (not shipped in the app).

use std::fmt;

#[derive(Debug, PartialEq)]
pub enum ParseError {
    Empty,
    Ragged { line: usize },
    BadChar { line: usize, ch: char },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Grid {
    width: usize,
    height: usize,
    cells: Vec<bool>,
    wrap: bool,
}

impl Grid {
    pub fn new(width: usize, height: usize) -> Grid {
        Grid { width, height, cells: vec![false; width * height], wrap: false }
    }

    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    pub fn get(&self, x: usize, y: usize) -> bool {
        x < self.width && y < self.height && self.cells[y * self.width + x]
    }

    pub fn set(&mut self, x: usize, y: usize, alive: bool) {
        if x < self.width && y < self.height {
            self.cells[y * self.width + x] = alive;
        }
    }

    pub fn population(&self) -> usize {
        self.cells.iter().filter(|&&c| c).count()
    }

    pub fn parse(s: &str) -> Result<Grid, ParseError> {
        let lines: Vec<&str> = s.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
        let Some(first) = lines.first() else {
            return Err(ParseError::Empty);
        };
        let width = first.chars().count();
        let mut grid = Grid::new(width, lines.len());
        for (y, line) in lines.iter().enumerate() {
            if line.chars().count() != width {
                return Err(ParseError::Ragged { line: y + 1 });
            }
            for (x, ch) in line.chars().enumerate() {
                match ch {
                    '#' => grid.set(x, y, true),
                    '.' => {}
                    _ => return Err(ParseError::BadChar { line: y + 1, ch }),
                }
            }
        }
        Ok(grid)
    }

    pub fn live_neighbours(&self, x: usize, y: usize) -> usize {
        let (w, h) = (self.width as isize, self.height as isize);
        let mut n = 0;
        for dy in -1isize..=1 {
            for dx in -1isize..=1 {
                if dx == 0 && dy == 0 {
                    continue;
                }
                let (mut nx, mut ny) = (x as isize + dx, y as isize + dy);
                if self.wrap {
                    nx = nx.rem_euclid(w);
                    ny = ny.rem_euclid(h);
                } else if nx < 0 || ny < 0 || nx >= w || ny >= h {
                    continue;
                }
                if self.get(nx as usize, ny as usize) {
                    n += 1;
                }
            }
        }
        n
    }

    pub fn step(&self) -> Grid {
        let mut next = Grid { cells: vec![false; self.cells.len()], ..self.clone() };
        for y in 0..self.height {
            for x in 0..self.width {
                let n = self.live_neighbours(x, y);
                let alive = matches!((self.get(x, y), n), (true, 2) | (_, 3));
                next.set(x, y, alive);
            }
        }
        next
    }

    pub fn with_wrap(mut self, wrap: bool) -> Grid {
        self.wrap = wrap;
        self
    }

    pub fn period(&self, max: usize) -> Option<usize> {
        let mut g = self.step();
        for p in 1..=max {
            if g == *self {
                return Some(p);
            }
            g = g.step();
        }
        None
    }
}

impl fmt::Display for Grid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for y in 0..self.height {
            if y > 0 {
                writeln!(f)?;
            }
            for x in 0..self.width {
                write!(f, "{}", if self.get(x, y) { '#' } else { '.' })?;
            }
        }
        Ok(())
    }
}
