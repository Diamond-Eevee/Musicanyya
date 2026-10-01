\version "2.24.0"
% Grieg, Peer Gynt Suite No. 1, Op. 46 No. 1, "Morgenstimmung" (Morning Mood), the composer's piano arrangement.
% Transcription A (Musicanyya, feature 019 task T040): our own reading of G. Schirmer, New York, copyright 1899,
% edited and fingered by Louis Oesterle; Internet Archive 31761045200615, PDF pages 7-10 (leaves n6-n9).
% Licence: CC0-1.0. Absolute pitches, Dutch note names. Bar numbers are the print's (87 bars, no repeats).
% Departures forced by the reader's LilyPond subset are marked "% subset:"; readings of unclear print "% unclear:";
% departures from the print made for the library item (staff placement only) "% item:".

\header {
  title = "Morgenstimmung"
  subtitle = "Morning Mood"
  composer = "Edvard Grieg"
  opus = "Op. 46 No. 1"
  source = "G. Schirmer, New York, 1899 (ed. and fingered by Louis Oesterle); Internet Archive 31761045200615"
  copyright = "CC0 1.0"
}

global = { \key e \major \time 6/8 }

rhOne = {
  \clef treble \global
  \tempo "Allegretto pastorale." 4. = 60
  % 1-4
  b''8-5\p_\markup { \italic "dolce" }( gis'' fis'' e'' fis'' gis'') |
  b''8( \grace { gis''16[ a''] } gis''8) fis'' e'' fis''16 gis'' fis'' gis''-3 |
  \grace { gis''16-2[ a''] } b''8\<( gis'' b'' cis'''\> gis'' cis''' |
  b''8-5 gis''-4 fis'' e''4)\! r8 |
  % 5-8
  b'8( gis' fis' e' fis' gis') |
  b'8( \grace { gis'16[ a'] } gis'8) fis' e'-1 fis'16 gis' fis' gis' |
  \grace { gis'16-2[ a'] } b'8\<( gis' b'-4 cis'' gis' cis''-4\! |
  dis''8\> bis'-4 ais' gis'4)\! r8 |
  % 9-12
  dis'''8-5( bis''-3 ais'' gis'' ais'' bis'') |
  dis'''8( \grace { bis''16[ cis'''] } bis''8) ais'' gis'' ais''16 bis'' ais'' bis''-3 |
  \grace { bis''16-2[ cis'''] } dis'''8\<( bis'' dis''' e'''\> bis'' e''' |
  dis'''8 bis'' ais'' gis''4-2)\! r8 |
  % 13-16
  dis''8( bis'-4 ais' gis' ais'-2 bis') |
  dis''8( \grace { bis'16-3[ cis''] } bis'8) ais' gis'-1 ais'16 bis' ais' bis' |
  \grace { bis'16-2[ cis''] } dis''8\<( bis' dis'' e'' cis'' e''\! |
  fis''8 dis'' cis'' b'4) r8 |
  % 17-20
  fis'''8( dis''' cis''' b''-2 cis'''16 dis''' cis''' dis''') |
  fis''8( dis'' cis'' b' cis''16 dis'' cis'' dis'') |
  fis'''8\<( dis''' b'') fis''( dis'' b') |
  fis'''8( dis''' b'') fis''( dis'' b')\! |
  % 21-24
  <b' e'' b''>8\f( <gis' gis''> <fis' fis''> <e' e''> <fis' fis''> <gis' gis''>) |
  <b' e'' b''>8( \grace { gis''16-4[ a''] } <gis' gis''>8) <fis' fis''> <e' e''> <fis' fis''>16-4 <gis' gis''> <fis' fis''> <gis' gis''> |
  \grace { gis''16-3[ a''] } b''8( gis'' b''-5) cis'''( gis'' cis''') |
  cis'''8( a''-4 gis'' fis''4) r8 |
  % 25-29
  <cis'' e'' cis'''>8( <a' a''> <gis' gis''> <fis' fis''> <gis' gis''> <a' a''>) |
  <cis'' e'' cis'''>8( \grace { a''16[ b''] } <a' a''>8) <gis' gis''> <fis' fis''> <gis' gis''>16 <a' a''> <gis' gis''> <a' a''> |
  \grace { a''16-3[ b''] } cis'''8( a'' cis''') dis'''^\markup { \italic "più" \dynamic "f" }( a'' dis''') |
  \grace { dis'''16-4[ e'''] } dis'''8( b'' dis''') e'''( b'' e''') |
  \grace { e'''16-4[ fis'''] } e'''8( cis''' e''') fis'''( cis''' fis''') |
  % 30-31: the left hand plays the 16ths written in the upper staff ("l.h.")
  <gis'' gis'''>16\ff( dis''' bis'' gis'' bis'' dis'''-3) dis'''-5\>( bis''-4 gis'' dis'' gis'' bis''-4) |
  bis''16-5( gis'' dis'' bis' dis'' gis''-4) gis''-5( dis'' bis' gis' bis' dis''-3)\! |
  % 32-35
  r8 <gis'' cis'''>8\p( cis'') r8 <fis'' cis'''>8( cis'') |
  r8 <e'' cis'''>8\<( cis'') r8 <fis'' cis'''>8( cis'')\! |
  <gis'' gis'''>16->\ff\>( dis''' bis'' gis'' bis'' dis'''-3)\! r8 <e''-2 cis'''-5>8\p\<( cis''-1)\! |
  <gis'' gis'''>16->\ff\>( dis''' bis'' gis'' bis'' dis''')\! r8 <e'' cis'''>8\p\<( cis'')\! |
  % 36-39
  bis'16-4\p( gis' dis' gis' bis' dis''-5) dis''-3( bis' gis' bis' dis'' gis''-5) |
  gis''16-4^\markup { \italic "molto" }\<( dis'' bis' dis'' gis'' bis''-5) c'''-4( g'' e'' g'' c''' e''')\! |
  <f'' f'''>16\ff( c''' a'' f'' a'' c'''-3) c'''-5\>( a'' f'' c'' f'' a''-4) |
  a''16-5( f'' c'' a' c'' f''-4) f''-5( c'' a' f' a' c''-3)\! |
  % 40-43
  r8 <f'' bes''>8( bes') r8 <es'' bes''>8( bes') |
  r8 <des'' bes''>8\<( bes') r8 <es'' bes''>8( bes')\! |
  <f'' f'''>16->\ff\>( c''' a'' f'' a'' c'''-3)\! r8 <des'' bes''>8\p\<( bes')\! |
  <f'' f'''>16->\ff\>( c''' a'' f'' a'' c''')\! r8 <des'' bes''>8\p\<( bes')\! |
  % 44-47
  a'16-4\p( f' c' f' a' c''-5) c''-3( a' f' a' c'' f''-5) |
  f''16-4^\markup { \italic "molto" }\<( c'' a' c'' f'' a''-5) a''-4( e'' cis'' e'' a'' cis'''-4)\! |
  <d'' d'''>16\ff( a'' fis'' d'' fis'' a'') d'''\>( a'' fis'' d'' fis'' a'') |
  d'''16( a'' fis'' d'' fis'' a'') d'''( a'' fis'' d'' fis'' a'')\! |
  % 48-55
  <fis'' d'''>16\p( a'' fis'' d'' fis'' a'') <fis'' d'''>16( a'' fis'' d'' fis'' a''_\markup { \italic "dim. e" }) |
  <f'' des'''>16^\markup { \italic "tranquillo" }( a'' f'' des'' f'' a'') <f'' des'''>16( a'' f'' des'' f'' a'') |
  <f'' c'''>16\pp( a''-4 f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'') |
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'') |
  <f'' c'''>16\<( a'' f'' c'' f'' a'')\! <f'' d'''>16\>( a'' f'' d'' f'' a'')\! |
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'') |
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a''_\markup { \italic "dim. e" }) |
  <e'' c'''>16^\markup { \italic "tranquillo" }( gis''-3 e'' c'' e'' gis'') <e'' c'''>16( gis'' e'' c'' e'' gis'') |
  % 56-63
  <e'' b''>16( gis''-4 e'' b' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' b''>16( gis'' e'' b' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' b''>16\<( gis'' e'' b' e'' gis'')\! <e'' cis'''>16\>( gis'' e'' cis'' e'' gis'')\! |
  <e'' b''>16( gis'' e'' b' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' cis'''>16->\>( gis'' e'' cis'' e'' gis'')\! <e'' b''>16\<( gis'' e'' b' e'' gis'')\! |
  <e'' cis'''>16->\>( gis'' e'' cis'' e'' gis'')\! <e'' b''>16\<( gis'' e'' b' e'' gis'')\! |
  <e'' cis'''>16->( gis'' e'' cis'' e'' gis'') <e'' cis'''>16( gis'' e'' cis'' e'' gis'') |
  R2. |
  % 64-67
  b'8\pp^\markup { \italic "tranquillo" }( gis' fis' e' fis' gis' |
  b'8 gis' fis' e' fis'16 gis' fis' gis') |
  b'8-2( gis' b'-4 cis''-2 ais' cis''-3 |
  % 67-75: each trill's printed Nachschlag (two small 16ths) at the end of its trill note, before the rest
  \afterGrace dis''2.-4\trill) { cis''16[ dis''] } |
  % 68-71
  \afterGrace b''4-3\trill { ais''16[ b''] } r8 \afterGrace b''4\trill { ais''16[ b''] } r8 |
  \afterGrace b''4\trill { ais''16[ b''] } r8 \afterGrace b''4\trill { ais''16[ b''] } r8 |
  b'8-4( gis' b' cis''-2 ais' cis'' |
  \afterGrace dis''2.\trill) { cis''16[ dis''] } |
  % 72-76
  \afterGrace b''4\trill { ais''16[ b''] } r8 \afterGrace b''4\trill { ais''16[ b''] } r8 |
  \afterGrace dis''2.\trill_\markup { \italic "dim." } { cis''16[ dis''] } |
  \afterGrace b''4\trill { ais''16[ b''] } r8 \afterGrace dis''4.\trill { cis''16[ dis''] } |
  \afterGrace b''4\>\trill { ais''16[ b''] } r8 \afterGrace dis''4.\trill\! { cis''16[ dis''] } |
  R2. |
  % 77-82: bars 77-78 print nothing in the upper staff
  s2. |
  s2. |
  b''8^\markup { \italic "più tranquillo" }( gis'' fis'' e'' fis'' gis'') |
  b''8( gis'' fis'' e'' fis''16 gis'' fis'' gis'') |
  <b e' gis' b'>4.\< <cis' e' gis' cis''>4.\! |
  <b e' gis' b'>4.\> <cis' e' gis' cis''>4.\! |
  % 83-87
  <b' e'' gis'' b''>2.\pp |
  <cis'' e'' gis'' cis'''>2._\markup { \italic "poco rit." } |
  <e'' gis'' b'' e'''>2.->\arpeggio~ |
  <e'' gis'' b'' e'''>2.~ |
  <e'' gis'' b'' e'''>4 r8 r4 r8 \bar "|."
}

rhTwo = {
  \global
  % 1-4
  s2. | s2. | s4. cis''4.( | b'4.)~ b'4 s8 |
  % 5-8 (unclear: a curved bracket joins this voice to the melody; read as a layout mark, not encoded)
  <gis e'>2. | <gis e'>2. | e'4. e'4. | dis'4.~ dis'4 s8 |
  % 9-12
  s2. | s2. | s4. e''4.( | dis''4.)~ dis''4-1 s8 |
  % 13-16
  <bis gis'>2. | <bis gis'>2. | gis'4. <e' gis'>4. | <fis'~ b'!>4. fis'4 s8 |
  % 17-20
  fis''2. | <fis' b'>2. | fis''4. <fis' b'>4. | fis''4. <fis' b'>4. |
  % 21-29
  s2. | s2. | b'4. <cis'' e''>4. | <cis'' e''>4.~ <cis'' e''>4 s8 |
  s2. | s2. | e''4. <dis'' fis''>4. | fis''4. <e'' gis''>4. | gis''4. <fis'' a''>4. |
  % 30-31: "l.h." in the upper staff
  s4. gis''16-2[ dis''-4] r8 r8 |
  dis''16-2[ bis'-4] r8 r8 bis'16[ gis'] r8 r8 |
  % 32-35: the inner voice is taken by the left hand (bracket, fingering 1)
  gis'4.-1( fis'4.-2 | e'4.-1 fis'4.-2) | s4. e'4-2( fis'8) | s4. e'4( fis'8) |
  % 36-39
  s2. | s4. e''4. | s4. f''16-2[ c''-4] r8 r8 | c''16-2[ a'-4] r8 r8 a'16-2[ f'-4] r8 r8 |
  % 40-43
  f'4.-1( es'4. | des'4. es'4.) | s4. des'4-2( es'8) | s4. des'4( es'8) |
  % 44-47
  s2. | s4. cis''4. | s4. fis''16-2[ d''-4] r8 r8 | fis''16[ d''] r8 r8 fis''16[ d''] r8 r8 |
  % 48-63
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  % 64-67
  e'4. e'4. | e'4. e'4. | e'2. | <dis' a'!>4 r8 r4 r8 |
  % 68-71
  e''4-> s8 e''4-> s8 | e''4-> s8 e''4-> s8 | e'2. | <dis' a'!>4 r8 r4 r8 |
  % 72-76
  e''4-> s8 e''4-> s8 | <dis' a'!>4 r8 r4 r8 | e''4-> s8 <dis' a'!>4 r8 | e''4-> s8 <dis' a'!>4 r8 | s2. |
  % 77-87
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2.
}

lhOne = {
  \clef bass \global
  % 1-4 (unclear: the left-hand chords of bars 1-20 carry a curved bracket, not the wavy arpeggio sign of bars
  % 21-29; its meaning is not certain, so it is not encoded)
  <e b gis'>2.\sustainOn |
  <e b gis'>2. |
  <e b gis'>4. <cis gis e'>4. |
  gis'4.~ gis'4 r8 |
  % 5-8
  <e, b, e>2.\sustainOn | <e, b, e>2. | <e, b, gis>4. <cis gis cis'>4. | <gis, dis bis>4. dis'8-2( bis-3 ais) |
  % 9-12
  <gis dis' bis'>2.\sustainOn |
  <gis dis' bis'>2. |
  <gis dis' bis'>4. <e bis gis'>4. |
  bis'4.~ bis'4 r8 |
  % 13-16
  <gis, dis gis>2.\sustainOn | <gis, dis gis>2. | <gis, dis bis>4. <cis gis cis'>4. |
  <b, fis dis'>4. fis'8-2( dis'-3 cis') |
  % 17-20
  \clef treble <b fis' dis''>2.\sustainOn |
  \clef bass <b, fis dis'>2.\sustainOn |
  \clef treble <b fis' dis''>4. \clef bass <b, fis dis'>4. |
  \clef treble <b a' dis''>4.\sustainOn \clef bass <b, a dis'>4. |
  % 21-24
  <e, b, gis>2.\arpeggio\sustainOn |
  <e, b, gis>2.\arpeggio\sustainOn |
  <e, b, gis>4.\arpeggio\sustainOn <e, cis gis>4.\arpeggio\sustainOn |
  <fis, cis a>4.\arpeggio\sustainOn <cis cis'>8( <a, a> <gis, gis>) |
  % 25-29
  <fis, cis e a>2.\arpeggio\sustainOn |
  <fis, cis e a>2.\arpeggio\sustainOn |
  <fis, cis e a>4.\arpeggio\sustainOn <fis, dis a>4.\arpeggio\sustainOn |
  <gis, dis fis b>4.\arpeggio\sustainOn <gis, e b>4.\arpeggio\sustainOn |
  <a, e gis cis'>4.\arpeggio\sustainOn <a, fis cis'>4.\arpeggio\sustainOn |
  % 30-31
  <gis, dis bis>4.\arpeggio\sustainOn s4. |
  s2. |
  % 32-35
  <a-5 cis'-3>2.~ | <a cis'>2. |
  <gis, dis bis>4.\arpeggio\sustainOn <a-5 cis'-3>4. |
  <gis, dis bis>4.\arpeggio\sustainOn <a cis'>4. |
  % 36-39
  <gis, dis bis>2.\arpeggio\sustainOn~ |
  <gis, dis bis>4. <g, c e bes>4.\sustainOn |
  <f, c a>4.\arpeggio\sustainOn s4. |
  s2. |
  % 40-43
  <ges-5 bes-4>2.~ | <ges bes>2. |
  <f, c a>4.\sustainOn <ges-5 bes-3>4. |
  <f, c a>4.\sustainOn <ges bes>4. |
  % 44-47
  <f, c a>2.\sustainOn~ |
  <f, c a>4. <e, a, cis g>4.\arpeggio\sustainOn |
  <d, a, fis>4.\sustainOn s4. |
  s2. |
  % 48-49
  \clef treble <d'-4 fis' a'>2.->( |
  <des' f' a'>2.) |
  % 50-53; bars 52, 58, 60-62: the print's arpeggio line runs from the lower voice's chord up through this melody
  % note struck with it, so the note is rolled with the chord (019 T098)
  \clef bass c'8( a-2 g f g a |
  c'8 a g f g16 a g a) |
  c'8( a c') d'\arpeggio( a d') |
  <c f a c'>4.~ <c f a c'>8 r8 r8 |
  % 54-55
  \clef treble <c'-4 f' a'>2.->( |
  <c' e' gis'>2.) |
  % 56-59
  \clef bass b8( gis fis e-1 fis-3 gis |
  b8 gis fis e fis16 gis fis gis) |
  b8( gis b) cis'\arpeggio( gis cis') |
  <b, e gis b>4.~ <b, e gis b>8 r8 r8 |
  % 60-63
  cis'8->\arpeggio( gis cis') <b, e gis b>4 r8 |
  cis'8->\arpeggio( gis cis') <b, e gis b>4 r8 |
  cis'2.->\arpeggio( |
  gis4. cis'4.) |
  % 64-67
  <b, gis b>4.( <cis-3 a>4. |
  <b, gis>4. <a, e cis'>4.) |
  <cis-3 e>2. |
  <fis, b, a!>2.\arpeggio\sustainOn |
  % 68-71
  <e, b, gis>8\sustainOn \clef treble <b-5 fis'-2>8( <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  <e' gis'>8->( <b fis'> <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  \clef bass <cis e>2. |
  <fis, b, a!>2.\arpeggio\sustainOn |
  % 72-76
  <e, b, gis>8\sustainOn \clef treble <b fis'>8( <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  \clef bass <fis, b, a!>2.\arpeggio\sustainOn |
  <e, b, gis>8\sustainOn \clef treble <b fis'>8( <e' gis'>-.) \clef bass <fis, b, a!>4\arpeggio\sustainOn r8 |
  <e, b, gis>8\sustainOn \clef treble <b fis'>8( <e' gis'>-.) \clef bass <fis, b, a!>4\arpeggio\sustainOn r8 |
  R2. |
  % 77-78; item: the print has these right-hand chords in the lower staff (the upper staff is empty); the item prints
  % them on the upper staff, so the level check does not count them with the left hand's octave (owner decision OD-3,
  % 019 T097, as Chopin Op. 28 No. 4 bars 24-25)
  \change Staff = "upper" <fis a b dis'>2.-> |
  <fis a b dis'>4.-> <fis a b e'>4.-> \change Staff = "lower" |
  % 79-82
  <b, gis~>4.\sustainOn <cis gis>4. |
  <b, gis~>4. <cis gis>4. |
  r8 gis8-1( fis e fis gis |
  r8 gis8( fis e fis16 gis fis gis) |
  % 83-87
  <b, gis-2 b-1 e'-2>2.\arpeggio\sustainOn |
  <a, e gis cis'>2.\arpeggio\sustainOn |
  <e, b,~ e-1~ gis-3~ b-2~ e'-1~>2.\arpeggio\sustainOn |
  <b, e gis b e'>2.~ |
  <b, e gis b e'>4 r8 r4 r8 \bar "|."
}

lhTwo = {
  \global
  % 1-49
  s2. | s2. | s2. | <e b>4. b8-2[ gis-3 fis-4] |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | <gis dis'-3>4. dis'8-2[( bis ais-3)] |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  s2. | s2. |
  % 50-53
  \acciaccatura c,8 c2.\sustainOn~ | c2. | <c f a>4. <a, f-3 a>4.\arpeggio | s2. |
  % 54-55
  s2. | s2. |
  % 56-59
  \acciaccatura b,,8 b,2.\sustainOn~ | b,2. | <b, e gis>4. <gis, e gis>4.\arpeggio | s2. |
  % 60-63
  <gis, e gis>4.\arpeggio s4. | <gis, e gis>4.\arpeggio s4. | <gis, e gis>4.~\arpeggio <gis, e gis>4 r8 | r2. |
  % 64-65
  s2. | s2. |
  % 66-76
  gis,4. g,4. | s2. | s2. | s2. | gis,4. g,4. | s2. |
  s2. | s2. | s2. | s2. | s2. |
  % 77-78
  <b,, b,>8 r8 r8 r4 r8 | <b,, b,>8 r8 r8 <b,, b,>8 r8 r8 |
  % 79-82
  e,2. | e,2. | s2. | s2. |
  % 83-87; bars 85-86: the printed two-note tremolo E1-E2, two dotted quarters joined by three beams (32nds)
  s2. | s2. |
  r4 r8 \repeat tremolo 6 { e,,32 e, } |
  \repeat tremolo 6 { e,,32 e, } \repeat tremolo 6 { e,,32 e, } |
  e,,4\sustainOff s2
}

\score {
  \new PianoStaff <<
    \new Staff = "upper" <<
      \new Voice = "rhOne" { \voiceOne \rhOne }
      \new Voice = "rhTwo" { \voiceTwo \rhTwo }
    >>
    \new Staff = "lower" <<
      \new Voice = "lhOne" { \voiceOne \lhOne }
      \new Voice = "lhTwo" { \voiceTwo \lhTwo }
    >>
  >>
  \layout { }
}
