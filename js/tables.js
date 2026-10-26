// Constants read from X-Mess.exe (1998). Addresses refer to the original executable.

// animation frames per block type: ball bell cndl crkr gift snow star wrth (0x446540)
export const FRAMES = [17, 26, 19, 30, 16, 16, 17, 36];

// pieces placed at which the level goes up, indexed by the current level (0x4463b0)
export const LEVEL_AT = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 225, 250, 275, 300, 350, 500, 0];
// first block type in play, per level (0x446410)
export const TYPE_OFS = [500, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 1, 0, 0, 0, 0, 0];
// number of block types in play, per level (0x446474)
export const NUM_TYPES = [0, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 8, 8, 8, 8, 8];
// ticks of 20 ms between automatic drops, per level (0x4464d8)
export const SPEED = [8, 20, 20, 20, 20, 20, 19, 19, 19, 19, 18, 18, 18, 17, 17, 17, 16, 16, 15, 15, 14, 14, 13, 12, 11, 10];

// points (0x4463a0..0x4463ac)
export const PTS_LOCK = 25;
export const PTS_LINK = 250;
export const PTS_MOVE = 1;
export const PTS_DOWN = 1;

export const TICK_MS = 20;      // TTimerEx interval
// phase step per tick of the swaying menu texts; the original used 0.15 (one sway in 0.84 s)
export const WAVE_STEP = 0.05;
export const PF_X = 292;        // playfield origin on the 640x480 screen
export const PF_Y = 24;

export const STORY_PICS = ['i_manger', 'i_baby', 'i_gift', 'i_calend', 'i_stomp', 'i_koelf', 'i_hat'];

export const STORY = ["'t was christmas,", 'in the year 0 b.c.', 'a lonely stable in bethlehem.', 'a boy was born.', '', 'which sucked!', '',
  'for since he was born at christmas', 'time he was to have presents only', 'once every year.', '', 'the days passed and years went by',
  'until on one day...', '', '...say in... oh... 1998', '', 'he', 'had', 'enough!', '', "so he went up to santa's place and",
  "kicked some fraggin' elf-butt.", '', 'this was when the problems began.', 'the elves were knocked-out,', "the reindeer couldn't give a fuck,",
  'and miss santa was arranging a divorce.', '', 'so santa was all alone to do all the', 'christmas work, and there was a lot', 'of work to do.', '',
  'to put it short:', 'it was a mess', '', 'and that is where you come in,', 'you will be taking on the role of', 'santa to try and get everything in',
  'order so every kid gets the presents', 'he (or she) deserves.', '', 'i know...', '', "it's a crappy job.", '', "you'll never be able to complete",
  "all the work so there's really no", 'end to this game.', '', 'but, hey!', '', 'atleast you get to score!', '', '', 'anyway,', '', 'a merry christmas',
  'and', 'a happy new year', 'to everyone'];

// Placeholder hiscores: the table that shipped in Data\011.x98 is not known.
export const DEFAULT_SCORES = [
  'santa', 'rudolph', 'dasher', 'dancer', 'prancer', 'vixen', 'comet', 'cupid', 'donner', 'blitzen',
  'snowman', 'elf', 'angel', 'holly', 'ivy', 'tinsel', 'bauble', 'bell', 'candle', 'cracker',
  'gift', 'snowflake', 'star', 'wreath', 'mistletoe'
].map((name, i) => ({ name, score: 50000 - i * 2000, level: Math.max(1, 15 - Math.floor(i / 2)) }));
