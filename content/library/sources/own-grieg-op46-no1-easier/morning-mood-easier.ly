\version "2.24.0"
% Grieg, Peer Gynt Suite No. 1, Op. 46 No. 1, "Morgenstimmung" (Morning Mood), the composer's piano arrangement,
% with easier chords. Our own arrangement (Musicanyya, 2026-10-02, at the owner's request) of transcription A
% (content/library/sources/own-grieg-op46-no1-transcription-a/morning-mood.ly), itself our reading of G. Schirmer, New
% York, copyright 1899, edited and fingered by Louis Oesterle; Internet Archive 31761045200615, PDF pages 7-10.
% Licence: CC0-1.0. Absolute pitches, Dutch note names. Bar numbers are the print's (87 bars, no repeats).
%
% The one change from transcription A: every chord fits one hand. At no moment does a hand hold more than three keys
% or reach wider than an octave, and a note it holds while playing others lies within a sixth of them (Grieg writes
% left-hand tenths throughout, four- to six-note chords at the end, and holds inner notes an octave under the melody).
% Each changed place is marked "% arr:". The rules, applied the same way everywhere:
%   - a left-hand chord keeps its bass note; from C3 up it becomes the close triad over that bass (E3 B3 G#4 ->
%     E3 G#3 B3), below C3 bass, fifth and octave (E2 B2 G#3 -> E2 B2 E3), the open spacing Grieg uses himself in
%     bars 5-6; where the chord has a seventh, the seventh is kept in place of the octave or fifth (bars 20, 25-28, 37,
%     45) or is held by the right hand (bars 67-75);
%   - a four-note chord drops its doubled or lowest inner note; a right-hand chord keeps its top note;
%   - where a held note would stretch the hand past an octave, it goes (bars 4, 5-6, 12, 13-14, 67-75);
%   - a note held while the same hand plays others lies within a sixth of them: a wider held note moves to a closer
%     chord tone or is struck again with them (bars 3, 11, 15, 23, 27-29, 37, 45, 50-52, 56-58, 79-80);
%   - left-hand chords that were rolled only to reach their span are no longer rolled; the rolls that bring a melody
%     note in with its chord stay (bars 52, 58, 60-62), and so does the right hand's in bar 85;
%   - the inner voice the print gives to the left hand by a bracket (bars 32-35, 40-43) is written on the lower staff
%     (in lhTwo);
%   - melodies, rhythms, the left hand's single notes after its chords, dynamics, slurs and fingering of unchanged
%     notes are transcription A's.

\header {
  title = "Morgenstimmung"
  subtitle = "Morning Mood (easier chords)"
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
  b''8( \grace { gis''16[ a''] } gis''8 fis'' e'' fis''16 gis'' fis'' gis''-3) |
  \grace { gis''16-2[ a''] } b''8\<( gis'' b'' cis'''\> gis'' cis''' |
  b''8-5 gis''-4 fis'' e''4)\! r8 |
  % 5-8
  b'8( gis' fis' e' fis' gis') |
  b'8( \grace { gis'16[ a'] } gis'8 fis' e'-1 fis'16 gis' fis' gis') |
  \grace { gis'16-2[ a'] } b'8\<( gis' b'-4 cis'' gis' cis''-4\! |
  dis''8\> bis'-4 ais' gis'4)\! r8 |
  % 9-12
  dis'''8-5( bis''-3 ais'' gis'' ais'' bis'') |
  dis'''8( \grace { bis''16[ cis'''] } bis''8 ais'' gis'' ais''16 bis'' ais'' bis''-3) |
  \grace { bis''16-2[ cis'''] } dis'''8\<( bis'' dis''' e'''\> bis'' e''' |
  dis'''8-5 bis'' ais'' gis''4-2)\! r8 |
  % 13-16
  dis''8( bis'-4 ais' gis'-2 ais' bis') |
  dis''8( \grace { bis'16-3[ cis''] } bis'8 ais' gis'-1 ais'16 bis' ais' bis') |
  \grace { bis'16-2[ cis''] } dis''8\<( bis' dis'' e'' cis'' e''\! |
  fis''8 dis'' cis'' b'4-2) r8 |
  % 17-20
  fis'''8( dis''' cis''' b''-2 cis'''16 dis''' cis''' dis''') |
  fis''8( dis'' cis'' b' cis''16 dis'' cis'' dis'') |
  fis'''8\<( dis''' b'') fis''( dis'' b') |
  fis'''8( dis''' b'') fis''( dis'' b')\! |
  % 21-24
  <b' e'' b''>8\f( <gis' gis''> <fis' fis''> <e' e''> <fis' fis''> <gis' gis''>) |
  <b' e'' b''>8( \grace { gis''16-4[ a''] } <gis' gis''>8 <fis' fis''> <e' e''> <fis' fis''>16-4 <gis' gis''> <fis' fis''> <gis' gis''>) |
  \grace { gis''16-3[ a''] } b''8( gis'' b''-5) cis'''( gis'' cis''') |
  cis'''8( a''-4 gis'' fis''4) r8 |
  % 25-29
  <cis'' e'' cis'''>8( <a' a''> <gis' gis''> <fis' fis''> <gis' gis''> <a' a''>) |
  <cis'' e'' cis'''>8( \grace { a''16[ b''] } <a' a''>8 <gis' gis''> <fis' fis''> <gis' gis''>16 <a' a''> <gis' gis''> <a' a''>) |
  \grace { a''16-3[ b''] } cis'''8( a'' cis''') dis'''^\markup { \italic "più" \dynamic "f" }( a'' dis''') |
  \grace { dis'''16-4[ e'''] } dis'''8( b'' dis''') e'''( b'' e''') |
  \grace { e'''16-4[ fis'''] } e'''8( cis''' e''') fis'''( cis''' fis''') |
  % 30-31: the left hand plays the 16ths written in the upper staff ("l.h.")
  <gis'' gis'''>16\ff( dis''' bis'' gis'' bis'' dis'''-3) dis'''-5\>( bis''-4 gis'' dis'' gis'' bis''-4) |
  bis''16-5( gis'' dis'' bis' dis'' gis''-4) gis''-5( dis'' bis' gis' bis' dis''-3)\! |
  % 32-35
  r8\p <gis''-3 cis'''-5>8( cis'') r8 <fis'' cis'''>8( cis'') |
  r8 <e'' cis'''>8( cis'') r8 <fis'' cis'''>8\<( cis'')\! |
  <gis'' gis'''>16->\ff\>( dis''' bis'' gis'' bis'' dis'''-3)\! r8 <e''-2 cis'''-5>8\p\<( cis''-1)\! |
  <gis'' gis'''>16->\ff\>( dis''' bis'' gis'' bis'' dis''')\! r8 <e'' cis'''>8\p\<( cis'')\! |
  % 36-39
  bis'16-4\p( gis' dis' gis' bis' dis''-5) dis''-3( bis' gis' bis' dis'' gis''-5) |
  gis''16-4^\markup { \italic "molto" }\<( dis'' bis' dis'' gis'' bis''-5) c'''-4( g'' e'' g'' c''' e''')\! |
  <f'' f'''>16\ff( c''' a'' f'' a'' c'''-3) c'''-5\>( a''-4 f'' c'' f'' a''-4) |
  a''16-5( f'' c'' a' c'' f''-4) f''-5( c'' a' f' a' c''-3)\! |
  % 40-43
  r8 <f'' bes''>8( bes') r8 <es'' bes''>8( bes') |
  r8 <des'' bes''>8( bes') r8 <es'' bes''>8\<( bes')\! |
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
  <e'' cis'''>16->\>( gis'' e'' cis'' e'' gis'')\! <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' cis'''>16->\>( gis'' e'' cis'' e'' gis'')\! <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' cis'''>16->( gis'' e'' cis'' e'' gis'') <e'' cis'''>16( gis'' e'' cis'' e'' gis'') |
  R2. |
  % 64-67
  % 64-65: the melody's fourth eighth E4 shares its head with the lower voice's dotted-quarter E4 (one head, two
  % stems), so it is one key and is written once, in the lower voice (019 T045, checked against the print)
  b'8\pp^\markup { \italic "tranquillo" }( gis' fis' s8 fis' gis' |
  b'8 gis' fis' s8 fis'16 gis' fis' gis') |
  b'8( gis'-2 b'-4 cis'' ais'-2 cis''-3 |
  % 67-75: each trill's printed Nachschlag (two small 16ths) at the end of its trill note, before the rest
  \afterGrace dis''2.-4\trill) { cis''16[ dis''] } |
  % 68-71
  \afterGrace b''4-3\trill { ais''16[ b''] } r8 \afterGrace b''4\trill { ais''16[ b''] } r8 |
  \afterGrace b''4\trill { ais''16[ b''] } r8 \afterGrace b''4\trill { ais''16[ b''] } r8 |
  b'8-4( gis' b' cis'' ais'-2 cis'' |
  \afterGrace dis''2.\trill) { cis''16[ dis''] } |
  % 72-76
  \afterGrace b''4\trill { ais''16[ b''] } r8 \afterGrace b''4\trill { ais''16[ b''] } r8 |
  \afterGrace dis''2.\trill { cis''16[ dis''] } |
  \afterGrace b''4\trill_\markup { \italic "dim." } { ais''16[ b''] } r8 \afterGrace dis''4.\trill { cis''16[ dis''] } |
  \afterGrace b''4\>\trill { ais''16[ b''] } r8 \afterGrace dis''4.\trill\! { cis''16[ dis''] } |
  R2. |
  % 77-82: bars 77-78 print nothing in the upper staff
  s2. |
  s2. |
  b''8^\markup { \italic "più tranquillo" }( gis'' fis'' e'' fis'' gis'') |
  b''8( gis'' fis'' e'' fis''16 gis'' fis'' gis'') |
  % arr: 81-85, the four-note chords lose their lowest note (the top line stays)
  <e' gis' b'>4. <e' gis' cis''>4. |
  <e' gis' b'>4.\< <e' gis' cis''>4.\> |
  % 83-87
  <e'' gis'' b''>2.\!\pp |
  <e'' gis'' cis'''>2.\<_\markup { \italic "poco rit." } |
  <gis'' b'' e'''>2.->\arpeggio\!\>~ |
  <gis'' b'' e'''>2.~ |
  <gis'' b'' e'''>4\! r8 r4 r8 \bar "|."
}

rhTwo = {
  \global
  % 1-4; arr: 3 and 11, the inner voice's C#5 / E5 is a quarter, released before the melody strikes its octave above
  % again (the print holds it a dotted quarter)
  s2. | s2. | s4. cis''4( s8 | b'4.)~ b'4 s8 |
  % 5-8; arr: 5-6, the lower voice's G#3 goes (G#3 to the melody's B4 is a tenth)
  e'2. | e'2. | e'4. e'4. | dis'4.~ dis'4 s8 |
  % 9-12
  s2. | s2. | s4. e''4( s8 | dis''4.)~ dis''4-1 s8 |
  % 13-16; arr: 13-14, the lower voice's B#3 goes (B#3 to the melody's D#5 is a tenth)
  % arr: 15, G#4 alone (E4 would be held an octave under the melody's E5)
  gis'2. | gis'2. | gis'4. gis'4. | <fis'~ b'!>4. fis'4-1 s8 |
  % 17-20
  fis''2. | <fis' b'>2. | fis''4. <fis' b'>4. | fis''4. <fis' b'>4. |
  % 21-29; arr: 23, 27-29, the held inner voice keeps the note within a sixth of the melody's octave leaps (E5 for B4,
  % then the upper note of each pair: the lower one is an octave under the melody's next note)
  s2. | s2. | e''4. e''4. | <cis'' e''>4.~ <cis'' e''>4 s8 |
  s2. | s2. | e''4. fis''4. | fis''4. gis''4. | gis''4. a''4. |
  % 30-31: "l.h." in the upper staff
  s4. gis''16-2[(_\markup { \italic "l.h." } dis''-4]) r8 r8 |
  dis''16-2[( bis'-4]) r8 r8 bis'16[( gis']) r8 r8 |
  % 32-35: arr: the inner voice the print gives the left hand by a bracket (fingering 1) is in lhTwo
  s2. | s2. | s2. | s2. |
  % 36-39
  % arr: 37 and 45, the held E5 / C#5 goes (the melody plays it, and its octave above)
  s2. | s2. | s4. f''16-2[( c''-4]) r8 r8 | c''16-2[( a'-4]) r8 r8 a'16-2[( f'-4]) r8 r8 |
  % 40-43: arr: the left hand's inner voice is in lhTwo, as in bars 32-35
  s2. | s2. | s2. | s2. |
  % 44-47
  s2. | s2. | s4. fis''16-2[( d''-4]) r8 r8 | fis''16[( d'']) r8 r8 fis''16[( d'']) r8 r8 |
  % 48-63
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  % 64-67
  % arr: 65, the left hand's C#4 under the E4; 67-75, the trill's D# alone: A4 is held under it (D#4 to the trill's E5
  % would be a ninth)
  e'4. e'4. | e'4. <cis' e'>4. | e'2. | a'!4 r8 r4 r8 |
  % 68-71
  e''4-> s8 e''4-> s8 | e''4-> s8 e''4-> s8 | e'2. | a'!4 r8 r4 r8 |
  % 72-76
  e''4-> s8 e''4-> s8 | a'!4 r8 r4 r8 | e''4-> s8 a'!4 r8 | e''4-> s8 a'!4 r8 | s2. |
  % 77-87
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2.
}

lhOne = {
  \clef bass \global
  % 1-4; arr: 1-3, close triads over the bass (the print has E3 B3 G#4, a tenth)
  <e gis b>2.\sustainOn |
  <e gis b>2. |
  <e gis b>4. <cis e gis>4. |
  % arr: 4 and 12, the chord over the bass, then the single notes after it (the print ties a top voice, G#4 / B#4,
  % over them: a tenth above the bass)
  <e-5 gis-3 b-1>4. b8-2( gis-3 fis-4) |
  % 5-8; arr: 7-8, bass, fifth and octave (the print has the tenth E2 G#3, G#2 B#3)
  <e, b, e>2.\sustainOn | <e, b, e>2. | <e, b, e>4. <cis gis cis'>4. | <gis, dis gis>4. dis'8-2( bis-3 ais) |
  % 9-12; arr: 9-11, close triads over the bass
  <gis bis dis'>2.\sustainOn |
  <gis bis dis'>2. |
  <gis bis dis'>4. <e gis bis>4. |
  <gis-5 bis-3 dis'-1>4. dis'8-2( bis-3 ais) |
  % 13-16; arr: 15-16, bass, fifth and octave
  <gis, dis gis>2.\sustainOn | <gis, dis gis>2. | <gis, dis gis>4. <cis gis cis'>4. |
  <b, fis b>4. fis'8-2( dis'-3 cis') |
  % 17-20; arr: close triads over B3, bass, fifth and octave over B2; bar 20 keeps the seventh A
  \clef treble <b dis' fis'>2.\sustainOn |
  \clef bass <b, fis b>2.\sustainOn |
  \clef treble <b dis' fis'>4. \clef bass <b, fis b>4. |
  \clef treble <b dis' a'>4.\sustainOn \clef bass <b, fis a>4. |
  % 21-24; arr: 21-29, bass, fifth and octave (or seventh), no longer rolled
  <e, b, e>2.\sustainOn |
  <e, b, e>2.\sustainOn |
  <e, b, e>4.\sustainOn <e, cis e>4.\sustainOn |
  <fis, cis fis>4.\sustainOn <cis cis'>8( <a, a> <gis, gis>) |
  % 25-29
  <fis, cis e>2.\sustainOn |
  <fis, cis e>2.\sustainOn |
  <fis, cis e>4.\sustainOn <fis, dis fis>4.\sustainOn |
  <gis, dis fis>4.\sustainOn <gis, e gis>4.\sustainOn |
  <a, e gis>4.\sustainOn <a, fis a>4.\sustainOn |
  % 30-31; arr: 30, 34-37, bass, fifth and octave, no longer rolled
  <gis, dis gis>4.\sustainOn s4. |
  s2. |
  % 32-35
  <a-5 cis'-3>2.~ | <a cis'>2. |
  <gis, dis gis>4.\sustainOn <a-5 cis'-3>4. |
  <gis, dis gis>4.\sustainOn <a cis'>4. |
  % 36-39; arr: 37, the C7 over G2 as G2 Bb2 E3 (the print has G2 C3 E3 Bb3)
  <gis, dis gis>2.\sustainOn~ |
  <gis, dis gis>4. <g, bes, e>4.\sustainOn |
  <f, c f>4.\sustainOn s4. |
  s2. |
  % 40-43; arr: 42-46, bass, fifth and octave
  <ges-5 bes-4>2.~ | <ges bes>2. |
  <f, c f>4.\sustainOn <ges-5 bes-3>4. |
  <f, c f>4.\sustainOn <ges bes>4. |
  % 44-47; arr: 45, the A7 over E2 as E2 G2 C#3 (bass, seventh, third, as bar 37), no longer rolled
  <f, c f>2.\sustainOn~ |
  <f, c f>4. <e, g, cis>4.\sustainOn |
  <d, a, d>4.\sustainOn s4. |
  s2. |
  % 48-49
  % 48-49 and 54-55: of the curves to the next chord, the one joining the common tone (A4, C4) is a tie (019 T045)
  \clef treble <d'-4 fis' a'~>2.->( |
  <des' f' a'>2.) |
  % 50-53; bars 52, 58, 60-62: the print's arpeggio line runs from the lower voice's chord up through this melody
  % note struck with it, so the note is rolled with the chord (019 T098)
  \clef bass c'8( a-2 g f g a |
  c'8 a g f g16 a g a) |
  c'8( a c' d'\arpeggio a d') |
  % arr: 53, 59, the four-note chord loses its inner note
  <c a c'>4.~ <c a c'>8 r8 r8 |
  % 54-55
  \clef treble <c'-4~ f' a'>2.->( |
  <c' e' gis'>2.) |
  % 56-59
  \clef bass b8( gis fis e-1 fis-3 gis |
  b8 gis fis e fis16 gis fis gis) |
  b8( gis b cis'\arpeggio gis cis') |
  <b, gis b>4.~ <b, gis b>8 r8 r8 |
  % 60-63; arr: 60-61, the four-note chord loses its inner note
  cis'8->\arpeggio( gis cis') <b, gis b>4 r8 |
  cis'8->\arpeggio( gis cis') <b, gis b>4 r8 |
  cis'2.->\arpeggio( |
  gis4. cis'4.) |
  % 64-67; arr: 65, A2 E3, the print's C#4 goes to the right hand (A2 to C#4 is a tenth)
  <b, gis b>4.( <cis-3 a>4. |
  <b, gis>4. <a, e>4.) |
  % 66 and 70: the lower head sits on the B2 line, not in the C-sharp 3 space (019 T045, measured on the print)
  <b, e>2. |
  % arr: 67-75, F#2 B2 A3 as bass, fourth and octave, E2 B2 G#3 as bass, fifth and octave, no longer rolled
  <fis, b, fis>2.\sustainOn |
  % 68-71
  <e, b, e>8\p\sustainOn \clef treble <b-5 fis'-2>8( <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  <e' gis'>8->( <b fis'> <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  \clef bass <b, e>2. |
  <fis, b, fis>2.\sustainOn |
  % 72-76
  <e, b, e>8\sustainOn \clef treble <b fis'>8( <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  \clef bass <fis, b, fis>2.\sustainOn |
  <e, b, e>8\sustainOn \clef treble <b fis'>8( <e' gis'>-.) \clef bass <fis, b, fis>4\sustainOn r8 |
  <e, b, e>8\sustainOn \clef treble <b fis'>8( <e' gis'>-.) \clef bass <fis, b, fis>4\sustainOn r8 |
  R2. |
  % 77-78; item: the print has these right-hand chords in the lower staff (the upper staff is empty); the item prints
  % them on the upper staff, so the level check does not count them with the left hand's octave (owner decision OD-3,
  % 019 T097, as Chopin Op. 28 No. 4 bars 24-25); arr: the four-note B7 chords lose their fifth, F#3
  \change Staff = "upper" <a b dis'>2.-> |
  <a b dis'>4.-> <a b e'>4.-> \change Staff = "lower" |
  % 79-82
  % 79-80; arr: the held G#3 goes, so the hand holds E2 (lhTwo) under the inner voice's B2 and C#3 (the print: a tenth)
  b,4.\sustainOn cis4. | b,4. cis4. |
  r8 gis8-1( fis e fis gis) |
  r8 gis8( fis e fis16 gis fis gis) |
  % 83-87; arr: 83-84, bass, third and fifth or octave, no longer rolled
  <b, gis b>2.\sustainOn |
  % 84: the lowest head sits on the G2 line: G-sharp 2 (019 T045, measured on the print)
  <gis, e gis>2.\sustainOn |
  % arr: 85-87, the six-note chord becomes E2 B2 E3 struck alone and released into the tremolo (the print holds it
  % through bar 87 under the tremolo, which only the pedal can do)
  <e, b, e>4.\sustainOn s4. |
  s2. |
  s2. \bar "|."
}

lhTwo = {
  \global
  % 1-49 (bars 4 and 12: in lhOne)
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  % 32-35 and 40-43; arr: the inner voice the print writes in the upper staff and gives the left hand by a bracket
  % (fingering 1) is written here, on the lower staff
  gis'4.-1( fis'4.-2 | e'4.-1 fis'4.-2) | s4. e'4-2( fis'8) | s4. e'4( fis'8) |
  s2. | s2. | s2. | s2. |
  f'4.-1( es'4. | des'4. es'4.) | s4. des'4-2( es'8) | s4. des'4( es'8) |
  s2. | s2. | s2. | s2. |
  s2. | s2. |
  % 50-53; arr: 52, C3 under the melody's C4, then F3 A3 under its D4 (the print: C3 F3 A3, then A2 F3 A3: an eleventh)
  % arr: 50-52 and 56-58, the bass is struck again with the melody's octave above it instead of held under it (the pedal
  % holds it)
  % arr: 52, 58, 60-61, the lower voice leaves out the A3 / G#3 the melody strikes an eighth later (one key cannot be
  % held and struck again)
  \acciaccatura c,8 c2.\sustainOn | c2. | c4 r8 f4.\arpeggio | s2. |
  % 54-55
  s2. | s2. |
  % 56-59; arr: 58, B2 under the melody's B3, then E3 G#3 under its C#4
  \acciaccatura b,,8 b,2.\sustainOn | b,2. | b,4 r8 e4.\arpeggio | s2. |
  % 60-63; arr: E3 (and G#3 in bar 62) under the melody's C#4 (the print adds G#2: an eleventh)
  e4.\arpeggio s4. | e4.\arpeggio s4. | <e gis>4.~\arpeggio <e gis>4 r8 | r2. |
  % 64-65
  s2. | s2. |
  % 66-76
  gis,4.-3 g,4. | s2. | s2. | s2. | gis,4. g,4. | s2. |
  s2. | s2. | s2. | s2. | s2. |
  % 77-78
  <b,, b,>8 r8 r8 r4 r8 | <b,, b,>8 r8 r8 <b,, b,>8 r8 r8 |
  % 79-82
  e,2.~ | e,2. | s2. | s2. |
  % 83-87; bars 85-86: the printed two-note tremolo E1-E2, two dotted quarters joined by three beams (32nds)
  s2. | s2. |
  r4 r8 \repeat tremolo 6 { e,,32 e, } |
  \repeat tremolo 6 { e,,32 e, } \repeat tremolo 6 { e,,32 e, } |
  % arr: 87, the final E1 alone (the print adds the held chord)
  e,,4\sustainOff r8 r4 r8
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
