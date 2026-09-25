\version "2.18.2"
\header {
  title = "Blocks"
  composer = "Own work"
  mutopiacomposer = "Anonymous"
}
\paper { ragged-right = ##t }
music = \relative c'' { \repeat volta 2 { c4 d e f | } }
\score { \music \layout { } }
\score { \unfoldRepeats \music \midi { \tempo 4 = 100 } }
