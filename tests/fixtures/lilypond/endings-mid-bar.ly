% A 3/8 piece with a pickup inside the repeat, a first ending that completes the pickup bar, and a second ending
% that runs on into the next section's upbeat, written the way LilyPond 2.18 sources do it: an invisible bar line
% (\bar "") and a reset of Timing.measurePosition. The printed page shows: pickup | bar 1 | first ending (two
% eighths) :| second ending (one full bar: a8 r16 b c d) | bar 4.
\relative c'' {
  \time 3/8
  \repeat volta 2 {
    \partial 8 e16 d |
    e8 c a |
  }
  \alternative {
    { a4 }
    { a8 \bar "" r16 b \set Timing.measurePosition = #(ly:make-moment -1/8) c16 d }
  }
  e8 c b! |
  a8 r \bar "|."
}
