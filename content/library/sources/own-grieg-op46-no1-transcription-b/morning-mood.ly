\version "2.24.0"
% Transcription B (feature 019 T041, research R-15): our own CC0 reading of Grieg, Peer Gynt Suite No. 1 Op. 46,
% No. 1 "Morgenstimmung", the composer's piano arrangement, G. Schirmer 1899, edited and fingered by Louis Oesterle
% (Internet Archive 31761045200615, PDF pages 7-10). Written bar by bar from the page images in a session that never
% saw transcription A. Absolute pitches; a comment names each bar or group of bars. "% unclear:" marks a place where the print is hard to
% read and says how it was read.
%
% Signs of the print with no counterpart in the LilyPond subset:
% - a curved bracket "(" before many chords (bars 1-20 and later): read as a grouping bracket, not as a rolled chord
%   (the print draws rolled chords with the usual wavy line, e.g. on page 9); not written.
% - "Ped." marks with no release sign: each new "Ped." is written as a pedal change (\sustainOff\sustainOn).

\header {
  title = "Morgenstimmung (Morning Mood)"
  composer = "Edvard Grieg"
  opus = "Op. 46 No. 1"
  source = "G. Schirmer, 1899 (Internet Archive 31761045200615)"
  copyright = "Transcription: CC0 1.0"
}

upper = {
  \clef treble \key e \major \time 6/8
  \tempo "Allegretto pastorale." 4. = 60
  % bar 1
  b''8-5\p_\markup { \italic dolce }( gis'' fis'' e'' fis'' gis'') |
  % bar 2
  b''8( \grace { gis''16 a'' } gis''8 fis'' e'' fis''16 gis'' fis'' gis''-3) |
  % bars 3-4
  <<
    { \grace { gis''16-2 a'' } b''8(\< gis'' b''\! cis'''\> gis'' cis''' | b''8-5\! gis''-4 fis'' e''4) r8 }
    \\
    { s4. cis''4.( | b'4.)~ b'4 s8 }
  >> |
  % bar 5
  << { b'8( gis' fis' e' fis' gis') } \\ { <gis e'>2. } >> |
  % bar 6
  << { b'8( \grace { gis'16 a' } gis'8 fis' e'-1 fis'16 gis' fis' gis') } \\ { <gis e'>2. } >> |
  % bars 7-8
  <<
    { \grace { gis'16-2 a' } b'8(\< gis' b'-4 cis'' gis' cis''-4\! | dis''8-4\> bis'-4 ais' gis'4)\! r8 }
    \\
    { e'4. e'4. | dis'4.~ dis'4 s8 }
  >> |
  % bar 9
  dis'''8-5( bis''-3 ais'' gis'' ais'' bis'') |
  % bar 10
  dis'''8( \grace { bis''16 cis''' } bis''8 ais'' gis'' ais''16 bis'' ais'' bis''-3) |
  % bars 11-12
  <<
    { \grace { bis''16-2 cis''' } dis'''8(\< bis'' dis'''\! e'''\> bis'' e''' | dis'''8-5\! bis'' ais'' gis''4-2-1) r8 }
    \\
    { s4. e''4.( | dis''4.)~ dis''4 s8 }
  >> |
  % bar 13
  << { dis''8( bis'-4 ais' gis'-2 ais' bis') } \\ { <bis gis'>2. } >> |
  % bar 14
  << { dis''8( \grace { bis'16-3 cis'' } bis'8 ais' gis'-1 ais'16 bis' ais' bis') } \\ { <bis gis'>2. } >> |
  % bars 15-16
  <<
    { \grace { bis'16-2 cis'' } dis''8(\< bis' dis'' e'' cis'' e''\! | fis''8 dis'' cis'' b'4-2-1) r8 }
    \\
    { gis'4. <e' gis'>4. | <fis'~ b'>4. fis'4 s8 }
  >> |
  % bar 17
  << { fis'''8( dis''' cis''' b''-2 cis'''16 dis''' cis''' dis''') } \\ { fis''2. } >> |
  % bar 18
  << { fis''8( dis'' cis'' b' cis''16 dis'' cis'' dis'') } \\ { <fis' b'>2. } >> |
  % bar 19
  << { fis'''8(\< dis''' b'') fis''( dis'' b') } \\ { fis''4. <fis' b'>4. } >> |
  % bar 20
  << { fis'''8( dis''' b'') fis''( dis'' b')\! } \\ { fis''4. <fis' b'>4. } >> |
  % bar 21
  <b' e'' b''>8\f( <gis' gis''> <fis' fis''> <e' e''> <fis' fis''> <gis' gis''>) |
  % bar 22
  <b' e'' b''>8( \grace { gis''16-4 a'' } <gis' gis''>8 <fis' fis''> <e' e''> <fis' fis''>16-4 <gis' gis''> <fis' fis''> <gis' gis''>) |
  % bars 23-24
  <<
    { \grace { gis''16-3 a'' } b''8( gis'' b''-5) cis'''( gis'' cis''') | cis'''8( a''-4 gis'' fis''4) r8 }
    \\
    { b'4. <cis'' e''>4. | <cis'' e''>4.~ <cis'' e''>4 s8 }
  >> |
  % bar 25
  <cis'' e'' cis'''>8( <a' a''> <gis' gis''> <fis' fis''> <gis' gis''> <a' a''>) |
  % bar 26
  <cis'' e'' cis'''>8( \grace { a''16 b'' } <a' a''>8 <gis' gis''> <fis' fis''> <gis' gis''>16 <a' a''> <gis' gis''> <a' a''>) |
  % bar 27
  << { \grace { a''16-3 b'' } cis'''8( a'' cis''') dis'''( a'' dis''') } \\ { e''4. <dis'' fis''>4._\markup { \italic "più" \dynamic f } } >> |
  % bar 28
  << { \grace { dis'''16-4 e''' } dis'''8( b'' dis''') e'''( b'' e''') } \\ { fis''4. <e'' gis''>4. } >> |
  % bar 29
  << { \grace { e'''16-4 fis''' } e'''8( cis''' e''') fis'''( cis''' fis''') } \\ { gis''4. <fis'' a''>4. } >> |
  % bar 30 (the lower voice of the second half is marked "l.h." on the upper staff)
  <gis'' gis'''>16\ff( dis''' bis'' gis'' bis'' dis'''-3)
  << { dis'''16-5(\> bis''-4 gis'' dis'' gis'' bis''-4) } \\ { gis''16-2^\markup { \italic "l.h." }( dis''-4) r8 r8 } >> |
  % bar 31
  <<
    { bis''16-5( gis'' dis'' bis' dis'' gis''-4) gis''16-5( dis'' bis' gis' bis' dis''-3)\! }
    \\
    { dis''16-2( bis'-4) r8 r8 bis'16( gis') r8 r8 }
  >> |
  % bars 32-33 (the lower voice is bracketed with the left hand's chord: played by the left hand)
  <<
    { r8\p <gis''-3 cis'''-5>8( cis'') r8 <fis'' cis'''>8( cis'') | r8 <e'' cis'''>8( cis'') r8\< <fis'' cis'''>8( cis'')\! }
    \\
    { gis'4.-1( fis'4.-2 | e'4.-1 fis'4.-2) }
  >> |
  % bar 34
  <gis'' gis'''>16\ff\>( dis''' bis'' gis'' bis'' dis''')\!
  << { r8\p <e'' cis'''>8(\< cis'')\! } \\ { e'4-2 fis'8 } >> |
  % bar 35
  <gis'' gis'''>16\ff\>( dis''' bis'' gis'' bis'' dis''')\!
  << { r8\p <e'' cis'''>8(\< cis'')\! } \\ { e'4 fis'8 } >> |
  % bar 36
  bis'16-4\p( gis' dis' gis' bis' dis''-5) dis''-3( bis' gis' bis' dis'' gis''-5) |
  % bar 37
  gis''16-4(\< dis'' bis' dis'' gis'' bis''-5)
  << { c'''16-4( g'' e'' g'' c''' e''') } \\ { e''4._\markup { \italic molto } } >> |
  % bar 38 (as bar 30, a minor third lower)
  <f'' f'''>16\ff( c''' a'' f'' a'' c'''-3)
  << { c'''16-5(\> a''-4 f'' c'' f'' a''-4) } \\ { f''16-2( c''-4) r8 r8 } >> |
  % bar 39
  <<
    { a''16-5( f'' c'' a' c'' f''-4) f''16-5( c'' a' f' a' c''-3)\! }
    \\
    { c''16-2( a'-4) r8 r8 a'16-2( f'-4) r8 r8 }
  >> |
  % bars 40-41 (as bars 32-33, a minor third lower)
  <<
    { r8 <f'' bes''>8( bes') r8 <ees'' bes''>8( bes') | r8 <des'' bes''>8( bes') r8\< <ees'' bes''>8( bes')\! }
    \\
    { f'4.( ees'4. | des'4. ees'4.) }
  >> |
  % bar 42 (as bar 34, a minor third lower)
  <f'' f'''>16\ff\>( c''' a'' f'' a'' c''')\!
  << { r8\p <des'' bes''>8(\< bes')\! } \\ { des'4-2 ees'8 } >> |
  % bar 43
  <f'' f'''>16\ff\>( c''' a'' f'' a'' c''')\!
  << { r8\p <des'' bes''>8(\< bes')\! } \\ { des'4 ees'8 } >> |
  % bar 44 (as bar 36, a minor third lower)
  a'16-4\p( f' c' f' a' c''-5) c''-3( a' f' a' c'' f''-5) |
  % bar 45
  f''16-4(\< c'' a' c'' f'' a''-5)
  << { a''16-4( e'' cis'' e'' a'' cis'''-4) } \\ { cis''4._\markup { \italic molto } } >> |
  % bar 46
  <d'' d'''>16\ff( a'' fis'' d'' fis'' a'')
  << { d'''16(\> a'' fis'' d'' fis'' a'') } \\ { fis''16-2( d''-4) r8 r8 } >> |
  % bar 47
  <<
    { d'''16( a'' fis'' d'' fis'' a'') d'''16( a'' fis'' d'' fis'' a'')\! }
    \\
    { fis''16( d'') r8 r8 fis''16( d'') r8 r8 }
  >> |
  % bar 48
  <fis'' d'''>16\p( a'' fis'' d'' fis'' a'') <fis'' d'''>16( a'' fis'' d'' fis'' a'')_\markup { \italic "dim. e" } |
  % bar 49
  <f'' des'''>16( a'' f'' des'' f'' a'')_\markup { \italic tranquillo } <f'' des'''>16( a'' f'' des'' f'' a'') |
  % bars 50-53
  <f'' c'''>16( a''-4 f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'') |
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'') |
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' d'''>16( a'' f'' d'' f'' a'') |
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'') |
  % bar 54
  <f'' c'''>16( a'' f'' c'' f'' a'') <f'' c'''>16( a'' f'' c'' f'' a'')_\markup { \italic "dim. e" } |
  % bar 55
  <e'' c'''>16( gis''-3 e'' c'' e'' gis'')_\markup { \italic tranquillo } <e'' c'''>16( gis'' e'' c'' e'' gis'') |
  % bars 56-59 (as bars 50-53, a semitone lower)
  <e'' b''>16( gis''-4 e'' b' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' b''>16( gis'' e'' b' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' b''>16( gis'' e'' b' e'' gis'') <e'' cis'''>16( gis'' e'' cis'' e'' gis'') |
  <e'' b''>16( gis'' e'' b' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  % bars 60-61
  <e'' cis'''>16->( gis'' e'' cis'' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  <e'' cis'''>16->( gis'' e'' cis'' e'' gis'') <e'' b''>16( gis'' e'' b' e'' gis'') |
  % bar 62
  <e'' cis'''>16->( gis'' e'' cis'' e'' gis'') <e'' cis'''>16( gis'' e'' cis'' e'' gis'') |
  % bar 63
  R2. |
  % bars 64-65 (where the melody's E4 shares its head with the lower voice's E4, only the lower voice's note is
  % written: one key is struck)
  <<
    { b'8^\markup { \italic tranquillo }( gis' fis' s8 fis' gis' | b'8 gis' fis' s8 fis'16 gis' fis' gis') }
    \\
    { e'4.\pp e'4. | e'4. e'4. }
  >> |
  % bars 66-67
  <<
    { b'8( gis'-2 b'-4 cis'' ais'-2 cis''-3 | \afterGrace dis''2.)-4-5\trill { cis''16 dis'' } }
    \\
    { e'2. | <dis' a'>4 r8 r4 r8 }
  >> |
  % bars 68-69
  <<
    {
      \afterGrace b''4-3-4\trill { ais''16 b'' } s8 \afterGrace b''4\trill { ais''16 b'' } s8 |
      \afterGrace b''4\trill { ais''16 b'' } s8 \afterGrace b''4\trill { ais''16 b'' } s8
    }
    \\
    { e''4-> r8 e''4-> r8 | e''4-> r8 e''4-> r8 }
  >> |
  % bars 70-71 (as bars 66-67)
  <<
    { b'8-4( gis' b' cis'' ais'-2 cis'' | \afterGrace dis''2.)\trill { cis''16 dis'' } }
    \\
    { e'2. | <dis' a'>4 r8 r4 r8 }
  >> |
  % bars 72-73 (as bars 68 and 67)
  <<
    { \afterGrace b''4\trill { ais''16 b'' } s8 \afterGrace b''4\trill { ais''16 b'' } s8 | \afterGrace dis''2.\trill { cis''16 dis'' } }
    \\
    { e''4-> r8 e''4-> r8 | <dis' a'>4 r8 r4 r8 }
  >> |
  % bars 74-75
  <<
    {
      \afterGrace b''4\trill { ais''16 b'' } s8 \afterGrace dis''4.\trill { cis''16 dis'' } |
      \afterGrace b''4\trill { ais''16 b'' } s8 \afterGrace dis''4.\trill { cis''16 dis'' }
    }
    \\
    { e''4->_\markup { \italic dim. } r8 <dis' a'>4 r8 | e''4-> r8 <dis' a'>4 r8 }
  >> |
  % bar 76
  R2. |
  % bars 77-78 (the upper staff is empty: both hands play on the lower staff)
  s2. | s2. |
  % bars 79-80
  b''8_\markup { \italic "più tranquillo" }( gis'' fis'' e'' fis'' gis'' |
  b''8 gis'' fis'' e'' fis''16 gis'' fis'' gis'') |
  % bars 81-82
  <b e' gis' b'>4.\< <cis' e' gis' cis''>4.\> |
  <b e' gis' b'>4.\!\< <cis' e' gis' cis''>4.\> |
  % bar 83
  <b' e'' gis'' b''>2.\!\pp |
  % bar 84
  <cis'' e'' gis'' cis'''>2._\markup { \italic "poco rit." } |
  % bars 85-87 (the wavy line of bar 85 runs through both staves)
  <e'' gis'' b'' e'''>2.~->\arpeggio | <e'' gis'' b'' e'''>2.~ | <e'' gis'' b'' e'''>4 r8 r4 r8 \bar "|." |
}

lower = {
  \clef bass \key e \major \time 6/8
  % bar 1
  <e b gis'>2.\sustainOn |
  % bar 2
  <e b gis'>2. |
  % bar 3
  <e b gis'>4. <cis gis e'>4. |
  % bar 4
  << { gis'4.~ gis'4 r8 } \\ { <e b>4. b8-2( gis-3 fis-4) } >> |
  % bar 5
  <e, b, e>2.\sustainOff\sustainOn |
  % bar 6
  <e, b, e>2. |
  % bar 7
  <e, b, gis>4. <cis gis cis'>4. |
  % bar 8
  <gis, dis bis>4. dis'8-2( bis-3 ais) |
  % bar 9
  <gis dis' bis'>2.\sustainOff\sustainOn |
  % bar 10
  <gis dis' bis'>2. |
  % bar 11
  <gis dis' bis'>4. <e bis gis'>4. |
  % bar 12
  << { bis'4.~ bis'4 r8 } \\ { <gis dis'-3>4. dis'8-2( bis-3 ais) } >> |
  % bar 13
  <gis, dis gis>2.\sustainOff\sustainOn |
  % bar 14
  <gis, dis gis>2. |
  % bar 15
  <gis, dis bis>4. <cis gis cis'>4. |
  % bar 16
  <b, fis dis'>4. fis'8-2( dis'-3 cis') |
  % bar 17
  \clef treble <b fis' dis''>2.\sustainOff\sustainOn |
  % bar 18
  \clef bass <b, fis dis'>2.\sustainOff\sustainOn |
  % bar 19
  \clef treble <b fis' dis''>4. \clef bass <b, fis dis'>4. |
  % bar 20
  \clef treble <b a' dis''>4.\sustainOff\sustainOn \clef bass <b, a dis'>4. |
  % bar 21
  <e, b, gis>2.\arpeggio\sustainOff\sustainOn |
  % bar 22
  <e, b, gis>2.\arpeggio\sustainOff\sustainOn |
  % bar 23
  <e, b, gis>4.\arpeggio\sustainOff\sustainOn <e, cis gis>4.\arpeggio\sustainOff\sustainOn |
  % bar 24
  <fis, cis a>4.\arpeggio\sustainOff\sustainOn <cis cis'>8( <a, a> <gis, gis>) |
  % bar 25
  <fis, cis e a>2.\arpeggio\sustainOff\sustainOn |
  % bar 26
  <fis, cis e a>2.\arpeggio\sustainOff\sustainOn |
  % bar 27
  <fis, cis e a>4.\arpeggio\sustainOff\sustainOn <fis, dis a>4.\arpeggio\sustainOff\sustainOn |
  % bar 28
  <gis, dis fis b>4.\arpeggio\sustainOff\sustainOn <gis, e b>4.\arpeggio\sustainOff\sustainOn |
  % bar 29
  <a, e gis cis'>4.\arpeggio\sustainOff\sustainOn <a, fis cis'>4.\arpeggio\sustainOff\sustainOn |
  % bar 30
  <gis, dis bis>4.\arpeggio\sustainOff\sustainOn s4. |
  % bar 31 (the lower staff is empty: the left hand plays on the upper staff)
  s2. |
  % bars 32-33
  <a-5 cis'-3>2.~ | <a cis'>2. |
  % bar 34
  <gis, dis bis>4.\arpeggio\sustainOff\sustainOn <a-5 cis'-3>4. |
  % bar 35
  <gis, dis bis>4.\arpeggio\sustainOff\sustainOn <a cis'>4. |
  % bar 36
  <gis, dis bis>2.~\arpeggio\sustainOff\sustainOn |
  % bar 37
  <gis, dis bis>4. <g, c e bes>4.\sustainOff\sustainOn |
  % bar 38
  <f, c a>4.\sustainOff\sustainOn s4. |
  % bar 39 (the lower staff is empty: the left hand plays on the upper staff)
  s2. |
  % bars 40-41
  <ges-4 bes-1>2.~ | <ges bes>2. |
  % bar 42
  <f, c a>4.\sustainOff\sustainOn <ges-5 bes-3>4. |
  % bar 43
  <f, c a>4.\sustainOff\sustainOn <ges bes>4. |
  % bar 44
  <f, c a>2.~\sustainOff\sustainOn |
  % bar 45
  <f, c a>4. <e, a, cis g>4.\arpeggio\sustainOff\sustainOn |
  % bar 46
  <d, a, fis>4.\sustainOff\sustainOn s4. |
  % bar 47 (the lower staff is empty: the left hand plays on the upper staff)
  s2. |
  % bar 48
  \clef treble <d' fis' a'~>2.-4-> |
  % bar 49
  % unclear: the curves from the chord of bar 48 to this one: read as a tie on A4 (same note) and a slur D4 to D-flat 4
  <des' f' a'>2. |
  % bars 50-53 (the left hand's melody, stems up, over the held bass)
  \clef bass
  <<
    {
      c'8\pp( a g f g a | c' a g f g16 a g a | c'8 a c' d'\arpeggio a d' | c'4.~ c'8) r8 r8
    }
    \\
    {
      \acciaccatura c,8\sustainOff\sustainOn c2.~ | c2. | <c f a>4. <a, f a>4.\arpeggio | <c f a>4.~ <c f a>8 s4
    }
  >> |
  % bar 54
  \clef treble <c'~ f' a'>2.-> |
  % bar 55
  % unclear: as in bars 48-49, read as a tie on the common tone C4 and a slur on the other curve
  <c' e' gis'>2. |
  % bars 56-59 (as bars 50-53, a semitone lower)
  \clef bass
  <<
    {
      b8( gis fis e fis-1 gis-3 | b gis fis e fis16 gis fis gis | b8 gis b cis'\arpeggio gis cis' | b4.~ b8) r8 r8
    }
    \\
    {
      \acciaccatura b,,8\sustainOff\sustainOn b,2.~ | b,2. | <b, e gis>4. <gis, e gis>4.\arpeggio | <b, e gis>4.~ <b, e gis>8 s4
    }
  >> |
  % bars 60-61 (the wavy line runs through the melody note C-sharp 4 too)
  << { cis'8->\arpeggio( gis cis') } \\ { <gis, e gis>4.\arpeggio } >> <b, e gis b>4 r8 |
  << { cis'8->\arpeggio( gis cis') } \\ { <gis, e gis>4.\arpeggio } >> <b, e gis b>4 r8 |
  % bars 62-63
  <<
    { cis'2.->\arpeggio( | gis4. cis'4.) }
    \\
    { <gis, e gis>4.~\arpeggio <gis, e gis>4 r8 | R2. }
  >> |
  % bars 64-65
  <b, gis b>4. <cis-3 a>4. |
  <b, gis>4. <a, e cis'>4. |
  % bars 66-67 (the curve from G-sharp 2 to the F-sharp 2 of bar 67 is a slur across voices: not written)
  << { <b, e>2. } \\ { gis,4.-3 g,4. } >> |
  <fis, b, a>2.\arpeggio\sustainOff\sustainOn |
  % bars 68-69
  <e, b, gis>8\p\sustainOff\sustainOn \clef treble <b-2 fis'-5>8( <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  <e' gis'>8->( <b fis'> <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  % bars 70-71 (as bars 66-67)
  \clef bass << { <b, e>2. } \\ { gis,4. g,4. } >> |
  <fis, b, a>2.\arpeggio\sustainOff\sustainOn |
  % bars 72-73 (as bars 68 and 67)
  <e, b, gis>8\sustainOff\sustainOn \clef treble <b fis'>8( <e' gis'>-.) <e' gis'>8->( <b fis'> <e' gis'>-.) |
  \clef bass <fis, b, a>2.\arpeggio\sustainOff\sustainOn |
  % bars 74-75
  <e, b, gis>8\arpeggio\sustainOff\sustainOn \clef treble <b fis'>8( <e' gis'>-.) \clef bass <fis, b, a>4\arpeggio\sustainOff\sustainOn r8 |
  <e, b, gis>8\arpeggio\sustainOff\sustainOn \clef treble <b fis'>8( <e' gis'>-.) \clef bass <fis, b, a>4\arpeggio\sustainOff\sustainOn r8 |
  % bar 76
  R2.\sustainOff |
  % bars 77-78 (the right hand's chords are printed on this staff, stems up, over the left hand's octaves)
  <<
    { <fis a b dis'>2.-> | <fis a b dis'>4.-> <fis a b e'>4.-> }
    \\
    { <b,, b,>8 r8 r8 r4 r8 | <b,, b,>8 r8 r8 <b,, b,>8 r8 r8 }
  >> |
  % bars 79-80
  % unclear: the bar-long curves from G-sharp 3 and from E2 to the same notes in bar 80 are read as ties
  <<
    { gis2.~ | gis2. }
    \\
    { e,2.~\sustainOn | e,2. }
    \\
    { b,4. cis4. | b,4. cis4. }
  >> |
  % bars 81-82
  r8 gis8-1( fis e fis gis) |
  r8 gis8( fis e fis16 gis fis gis) |
  % bar 83
  <b,-2 gis-1 b-2 e'>2.\arpeggio\sustainOff\sustainOn |
  % bar 84
  <gis, e gis cis'>2.\arpeggio\sustainOff\sustainOn |
  % bars 85-87 (the rolled chord is held, tied and in the pedal, while the left hand plays the tremolo E1-E2; the
  % E2 of the chord is not tied)
  <<
    { <e, b,~ e~ gis~ b~ e'~>2.\arpeggio | <b, e gis b e'>2.~ | <b, e gis b e'>4 r8 r4 r8 }
    \\
    {
      r4\sustainOff\sustainOn r8 \repeat tremolo 6 { e,,32 e,32 } | \repeat tremolo 12 { e,,32 e,32 } |
      e,,4\sustainOff s2
    }
  >> |
}

\score {
  \new PianoStaff <<
    \new Staff = "up" \upper
    \new Staff = "down" \lower
  >>
  \layout { }
}
