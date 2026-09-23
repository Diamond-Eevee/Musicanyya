\score {
  \new PianoStaff <<
    \new Staff = "up" {
      << { c''4 } \\ { e'4 } >>
      \new Voice { g'4 }
      \change Staff = "down" c4
    }
    \new Staff = "down" {
      \clef bass
      c2
    }
  >>
}
