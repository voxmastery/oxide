// Milestone tests for the life build-along. Run one milestone with
// `cargo test --test milestones m3_`. Oxide puts this file back the way it was before each
// "Check milestone", so add your own tests in another file.

use life::{Grid, ParseError};

fn grid(picture: &str) -> Grid {
    Grid::parse(picture).expect("test picture should parse")
}

const BLINKER_V: &str = ".....\n..#..\n..#..\n..#..\n.....";
const BLINKER_H: &str = ".....\n.....\n.###.\n.....\n.....";

// ---- Milestone 1: a grid ---------------------------------------------------------------

#[test]
fn m1_new_grid_is_dead() {
    let g = Grid::new(4, 3);
    assert_eq!((g.width(), g.height()), (4, 3));
    assert_eq!(g.population(), 0);
    assert!(!g.get(3, 2));
}

#[test]
fn m1_set_and_get() {
    let mut g = Grid::new(4, 3);
    g.set(3, 0, true);
    g.set(0, 2, true);
    assert!(g.get(3, 0));
    assert!(g.get(0, 2));
    assert!(!g.get(0, 0));
    assert!(!g.get(2, 0), "x is the column and y the row");
    assert_eq!(g.population(), 2);
    g.set(3, 0, false);
    assert!(!g.get(3, 0));
    assert_eq!(g.population(), 1);
}

#[test]
fn m1_outside_the_grid() {
    let mut g = Grid::new(4, 3);
    g.set(4, 0, true);
    g.set(0, 3, true);
    g.set(99, 99, true);
    assert_eq!(g.population(), 0);
    assert!(!g.get(4, 0));
    assert!(!g.get(0, 3));
}

// ---- Milestone 2: read a picture -------------------------------------------------------

#[test]
fn m2_parse() {
    let g = grid(".#.\n..#\n###");
    assert_eq!((g.width(), g.height()), (3, 3));
    assert!(g.get(1, 0) && g.get(2, 1) && g.get(0, 2) && g.get(1, 2) && g.get(2, 2));
    assert!(!g.get(0, 0) && !g.get(1, 1));
    assert_eq!(g.population(), 5);
}

#[test]
fn m2_parse_ignores_indentation_and_blank_lines() {
    let g = grid("\n    ##\n\n    #.\n");
    assert_eq!((g.width(), g.height()), (2, 2));
    assert_eq!(g.population(), 3);
}

#[test]
fn m2_parse_errors() {
    assert_eq!(Grid::parse(""), Err(ParseError::Empty));
    assert_eq!(Grid::parse("  \n \n"), Err(ParseError::Empty));
    assert_eq!(Grid::parse("...\n..\n..."), Err(ParseError::Ragged { line: 2 }));
    assert_eq!(Grid::parse("...\n...\n.o."), Err(ParseError::BadChar { line: 3, ch: 'o' }));
}

// ---- Milestone 3: print it -------------------------------------------------------------

#[test]
fn m3_display() {
    let mut g = Grid::new(3, 2);
    g.set(0, 0, true);
    g.set(2, 1, true);
    assert_eq!(g.to_string(), "#..\n..#");
}

#[test]
fn m3_display_round_trip() {
    assert_eq!(grid(BLINKER_V).to_string(), BLINKER_V);
    assert_eq!(Grid::new(2, 1).to_string(), "..");
}

// ---- Milestone 4: neighbours -----------------------------------------------------------

#[test]
fn m4_neighbours_in_the_middle() {
    let g = grid("###\n#.#\n###");
    assert_eq!(g.live_neighbours(1, 1), 8);
    let g = grid("...\n.#.\n...");
    assert_eq!(g.live_neighbours(1, 1), 0, "a cell is not its own neighbour");
    assert_eq!(g.live_neighbours(0, 0), 1);
}

#[test]
fn m4_neighbours_at_the_edges() {
    let g = grid("##.\n#..\n...");
    assert_eq!(g.live_neighbours(0, 0), 2);
    assert_eq!(g.live_neighbours(2, 2), 0);
    assert_eq!(g.live_neighbours(1, 1), 3);
    let g = grid("#..\n...\n..#");
    assert_eq!(g.live_neighbours(2, 0), 0, "edges don't wrap yet");
}

// ---- Milestone 5: the next generation --------------------------------------------------

#[test]
fn m5_blinker_turns() {
    let g = grid(BLINKER_V);
    assert_eq!(g.step().to_string(), BLINKER_H);
    assert_eq!(g.step().step().to_string(), BLINKER_V);
}

#[test]
fn m5_block_stays() {
    let g = grid("....\n.##.\n.##.\n....");
    assert_eq!(g.step(), g);
}

#[test]
fn m5_lonely_and_crowded_cells_die() {
    assert_eq!(grid("...\n.#.\n...").step().population(), 0);
    assert_eq!(grid("###\n###\n###").step().to_string(), "#.#\n...\n#.#");
}

#[test]
fn m5_step_does_not_change_the_original() {
    let g = grid(BLINKER_V);
    let _ = g.step();
    assert_eq!(g.to_string(), BLINKER_V);
}

// ---- Milestone 6: wrap around ----------------------------------------------------------

#[test]
fn m6_wrapping_neighbours() {
    let g = grid("#..\n...\n..#").with_wrap(true);
    assert_eq!(g.live_neighbours(2, 0), 2);
    assert_eq!(g.live_neighbours(1, 1), 2);
    let g = grid("#...\n....\n....\n....").with_wrap(true);
    assert_eq!(g.live_neighbours(3, 3), 1);
    assert_eq!(g.live_neighbours(2, 2), 0);
}

#[test]
fn m6_blinker_across_the_edge() {
    let g = grid("#...\n#...\n#...\n....").with_wrap(false);
    assert_eq!(g.step().to_string(), "....\n##..\n....\n....");
    let g = grid("#...\n#...\n#...\n....").with_wrap(true);
    assert_eq!(g.step().to_string(), "....\n##.#\n....\n....");
}

#[test]
fn m6_glider_comes_back_round() {
    let mut g = grid(".#...\n..#..\n###..\n.....\n.....").with_wrap(true);
    let start = g.clone();
    for _ in 0..20 {
        g = g.step();
        assert_eq!(g.population(), 5, "a glider always has five cells");
    }
    assert_eq!(g, start);
}

// ---- Milestone 7: oscillators ----------------------------------------------------------

#[test]
fn m7_still_life_has_period_one() {
    assert_eq!(grid("....\n.##.\n.##.\n....").period(10), Some(1));
    assert_eq!(Grid::new(3, 3).period(10), Some(1));
}

#[test]
fn m7_blinker_and_toad_have_period_two() {
    assert_eq!(grid(BLINKER_V).period(10), Some(2));
    assert_eq!(grid("......\n......\n..###.\n.###..\n......\n......").period(10), Some(2));
}

#[test]
fn m7_glider_on_a_small_world() {
    let g = grid(".#...\n..#..\n###..\n.....\n.....").with_wrap(true);
    assert_eq!(g.period(30), Some(20));
    assert_eq!(g.period(19), None);
}

#[test]
fn m7_dying_pattern_never_repeats() {
    assert_eq!(grid("...\n.#.\n...").period(10), None);
}
