\score {
  \new PianoStaff <<
    \new Staff = "up" {
      << { e''4 f'' g''2 } \\ { c''2 e'' } >> |
      \new Voice { c''4 \change Staff = "down" g4 \change Staff = "up" e''2 } |
    }
    \new Staff = "down" {
      \clef bass
      c1 | s1 |
    }
  >>
}
