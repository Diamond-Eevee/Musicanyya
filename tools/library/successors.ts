// The successor table of feature 011 (specs/011-learning-by-key/data-model.md §7): every item of the old Learning shelf and
// the item that now covers it. The single source for `supersedes` in the generated sidecars (`build-exercises.ts`), for the
// audit report's "Replaced by feature 011" table, and for the tests. `hash` is the SHA-256 of the old file as it was on main
// (commit e450501, before this feature): remembered per-Score settings are keyed by it, so a successor can adopt them
// (contract library-port 1.2 §4). Dev-only: nothing at run time reads this file.

export interface Successor {
  /** The old item id, under `learning/chords/`. */
  oldId: string;
  /** The item that replaces it. */
  newId: string;
  /** `superseded`: a generated step covers the same skill; `moved`: the music is kept in its new folder. */
  kind: 'superseded' | 'moved';
  /** SHA-256 of the old file's bytes on main (e450501). */
  hash: string;
}

export const SUCCESSORS: readonly Successor[] = [
  {
    oldId: 'learning/chords/c-major-scale-and-chords',
    newId: 'learning/keys/c-major/beginner',
    kind: 'superseded',
    hash: '26bb5d0513f59a312c3a54bce350b2e1f78ffb6bd8c91ec3f9812197456490e4',
  },
  {
    oldId: 'learning/chords/changes/changes-a-minor-major-a-minor',
    newId: 'learning/key-changes/a-minor-to-a-major/minor-and-major',
    kind: 'moved',
    hash: 'dbadc1f9b60a25c50df77c1aec9aa643cfe9ba4ffad20c3966db2d4563048b84',
  },
  {
    oldId: 'learning/chords/changes/changes-cadence-c-major',
    newId: 'learning/keys/c-major/beginner',
    kind: 'superseded',
    hash: 'ef85f3675c2db88a39da2f2c6388d5b48566c784239748841f6b70eba75352f9',
  },
  {
    oldId: 'learning/chords/changes/changes-cadence-f-major',
    newId: 'learning/keys/f-major/beginner',
    kind: 'superseded',
    hash: '56a76f4c13e149946d39d1e5634c230477b41931ed77ec53fd84df7fe545aa6f',
  },
  {
    oldId: 'learning/chords/changes/changes-cadence-g-major',
    newId: 'learning/keys/g-major/beginner',
    kind: 'superseded',
    hash: '438a315d4359cbff41dd703ebcf440e4773d20aa1212978a57744016befa02c0',
  },
  {
    oldId: 'learning/chords/changes/changes-diatonic-ladder-c-major',
    newId: 'learning/keys/c-major/diatonic-ladder',
    kind: 'moved',
    hash: '22c7e7bda744c191eb5205a09d6ef0fc26fa99c685b1421c70be6c84b0316b14',
  },
  {
    oldId: 'learning/chords/changes/changes-i-iv-i-c-major',
    newId: 'learning/keys/c-major/beginner',
    kind: 'superseded',
    hash: '418e78c8eede6d694dc33a48c52f66e7544eb976eaf727e4cc1959642ec3f856',
  },
  {
    oldId: 'learning/chords/changes/changes-i-v-i-c-major',
    newId: 'learning/keys/c-major/introduction',
    kind: 'superseded',
    hash: 'f9500f50c7f5755d15626cab2d283a4c60d0b71f3198049fa7bf6d9dc8bf6748',
  },
  {
    oldId: 'learning/chords/changes/changes-i-v-vi-iv-c-major',
    newId: 'learning/keys/c-major/i-v-vi-iv',
    kind: 'moved',
    hash: '50aba9a1b6c03bf31cdaade7d3ff411a61d7109bf5b2fa94a235d6224e657125',
  },
  {
    oldId: 'learning/chords/changes/changes-i-vi-iv-v-c-major',
    newId: 'learning/keys/c-major/advanced',
    kind: 'superseded',
    hash: '2dec130074d40432e95a829a6acf43338ca7512d3481fbf68343590a31c70384',
  },
  {
    oldId: 'learning/chords/changes/changes-ii-v-i-c-major',
    newId: 'learning/keys/c-major/advanced',
    kind: 'superseded',
    hash: '6ef5c9b7be1ca15544627c2b2002f42139b996b51b8b2621157702ae737421b9',
  },
  {
    oldId: 'learning/chords/changes/changes-minor-cadence-a-minor',
    newId: 'learning/keys/a-minor/beginner',
    kind: 'superseded',
    hash: '31e79148d24a28c4cb62472269934d2b8f6ec879ac6e84e6af55561db01cdb81',
  },
  {
    oldId: 'learning/chords/changes/changes-minor-cadence-d-minor',
    newId: 'learning/keys/d-minor/beginner',
    kind: 'superseded',
    hash: 'd6cc36d5a53a3a029d64f17147206e3d29adfb2281ff0f4b10c1f35c7a796b80',
  },
  {
    oldId: 'learning/chords/changes/changes-plagal-perfect-c-major',
    newId: 'learning/keys/c-major/beginner',
    kind: 'superseded',
    hash: '9b18de007daecd611f8f43ed8332bc6436445acd80e61cf5e4e97451b92d2573',
  },
  {
    oldId: 'learning/chords/changes/changes-same-tonic-c-major',
    newId: 'learning/key-changes/c-major-to-c-minor/major-and-minor',
    kind: 'moved',
    hash: '8240b94812f0c015d8701fc9b3f4907ac87af7d74fbf65a78c8b44d648d6a148',
  },
  {
    oldId: 'learning/chords/changes/changes-tonic-inversions-c-major',
    newId: 'learning/keys/c-major/intermediate',
    kind: 'superseded',
    hash: '45a993eae746839e4c45bede4b61338d0373f08a16840fea21d0ef33b93533f6',
  },
  {
    oldId: 'learning/chords/changes/changes-turnaround-c-major',
    newId: 'learning/keys/c-major/turnaround',
    kind: 'moved',
    hash: '5578d7f61bf3a9dd896ef3a0c744c5636162c4b904ea5fde80e630417d8f3a4d',
  },
  {
    oldId: 'learning/chords/triads-a-flat-major',
    newId: 'learning/keys/a-flat-major/intermediate',
    kind: 'superseded',
    hash: 'e922cc1801198af2bde230b1182d2a7416c1e4a581df54859801f1b30a40c247',
  },
  {
    oldId: 'learning/chords/triads-a-major',
    newId: 'learning/keys/a-major/intermediate',
    kind: 'superseded',
    hash: '1f195d8c89ebfeae0edb8f5d2ab4b35ee317773b494c75b2e715b9324ac9d7ad',
  },
  {
    oldId: 'learning/chords/triads-a-minor',
    newId: 'learning/keys/a-minor/intermediate',
    kind: 'superseded',
    hash: '544be47467170d4913a8b1dd3550396dfd934bc15abbd7336b5d2f0a55246d1b',
  },
  {
    oldId: 'learning/chords/triads-b-flat-major',
    newId: 'learning/keys/b-flat-major/intermediate',
    kind: 'superseded',
    hash: 'bddb0860f2b59ef80b0cc9a04f4957bd0c9a3cff81337eb3597bf9c13976b3ab',
  },
  {
    oldId: 'learning/chords/triads-b-flat-minor',
    newId: 'learning/keys/b-flat-minor/intermediate',
    kind: 'superseded',
    hash: '501bf207ad179988c7ded08d92072909ded0182a5bbb2935bab52741e8df0a8a',
  },
  {
    oldId: 'learning/chords/triads-b-major',
    newId: 'learning/keys/b-major/intermediate',
    kind: 'superseded',
    hash: '2ea4e7e22c04c1ecc7f1e9b030c7183719289358e2551c4fe8427d82d90f2620',
  },
  {
    oldId: 'learning/chords/triads-b-minor',
    newId: 'learning/keys/b-minor/intermediate',
    kind: 'superseded',
    hash: '3cab2302a81619cdec707a01c79f505871cf9f4754622845787974ba4a3a7691',
  },
  {
    oldId: 'learning/chords/triads-c-major',
    newId: 'learning/keys/c-major/intermediate',
    kind: 'superseded',
    hash: 'a712aa993446e071ebb99cdd15684438198e567ef3eb5aef1d512d171178c137',
  },
  {
    oldId: 'learning/chords/triads-c-minor',
    newId: 'learning/keys/c-minor/intermediate',
    kind: 'superseded',
    hash: '2258205325e41bf47274ff892fbf2b6b639febf7aeafc2f1b5bce3c969944dcd',
  },
  {
    oldId: 'learning/chords/triads-c-sharp-minor',
    newId: 'learning/keys/c-sharp-minor/intermediate',
    kind: 'superseded',
    hash: '5e26e5b0a707364143407767b572dd8e75b5c535dd23376381a07f75b62c377b',
  },
  {
    oldId: 'learning/chords/triads-d-flat-major',
    newId: 'learning/keys/d-flat-major/intermediate',
    kind: 'superseded',
    hash: '3377e89cd045b74e573797367cf51b36fc5c62cd30b2d7a8480469c352e54a6e',
  },
  {
    oldId: 'learning/chords/triads-d-major',
    newId: 'learning/keys/d-major/intermediate',
    kind: 'superseded',
    hash: '1d774e413b4806a725473199c1caa97ae8601f7f946f021cafbe00e2f94bc4d0',
  },
  {
    oldId: 'learning/chords/triads-d-minor',
    newId: 'learning/keys/d-minor/intermediate',
    kind: 'superseded',
    hash: 'fdb7aa02128e68cad6de1abe35c74e9569ae778f886cac2c41de71256957eb27',
  },
  {
    oldId: 'learning/chords/triads-e-flat-major',
    newId: 'learning/keys/e-flat-major/intermediate',
    kind: 'superseded',
    hash: '47337ad1325fcd23cb2c6367a7faef9c061904ea91cc4b449e9675cdd0e8e529',
  },
  {
    oldId: 'learning/chords/triads-e-flat-minor',
    newId: 'learning/keys/e-flat-minor/intermediate',
    kind: 'superseded',
    hash: '27dd4fe82e343751d568ff57496f8a488381000bd2d708dbe229027c28a99b02',
  },
  {
    oldId: 'learning/chords/triads-e-major',
    newId: 'learning/keys/e-major/intermediate',
    kind: 'superseded',
    hash: '9f1ed1a2168e979d48a647c3c2d68133bd627ebf144b50312687a98f78c0f68b',
  },
  {
    oldId: 'learning/chords/triads-e-minor',
    newId: 'learning/keys/e-minor/intermediate',
    kind: 'superseded',
    hash: '3a7ffa1a9de94619971b0fb1335e7624271683e96a02dedbe87cffdbe7f8d9b4',
  },
  {
    oldId: 'learning/chords/triads-f-major',
    newId: 'learning/keys/f-major/intermediate',
    kind: 'superseded',
    hash: '49364df3f26bec91c7c351c1edb1ee3e443c885bb6a4c56f2c904d9155d081a2',
  },
  {
    oldId: 'learning/chords/triads-f-minor',
    newId: 'learning/keys/f-minor/intermediate',
    kind: 'superseded',
    hash: '2151be7840686748e319f010baf2f88a954f81f11c1507d8ca3edf6f07b7d8d0',
  },
  {
    oldId: 'learning/chords/triads-f-sharp-major',
    newId: 'learning/keys/f-sharp-major/intermediate',
    kind: 'superseded',
    hash: 'ffc5cc5de02fa59912b3039e61c6acdd61547caea9a3a433004cd8841cb2111d',
  },
  {
    oldId: 'learning/chords/triads-f-sharp-minor',
    newId: 'learning/keys/f-sharp-minor/intermediate',
    kind: 'superseded',
    hash: '36580728bc4f3205f3f0cb26c90ab1a6e77df1ac9ed2200ef648116c78b46c47',
  },
  {
    oldId: 'learning/chords/triads-g-major',
    newId: 'learning/keys/g-major/intermediate',
    kind: 'superseded',
    hash: '611b04306f0b0ee66f6238894b70e778d357a3847f54458a9a471afb2ae35051',
  },
  {
    oldId: 'learning/chords/triads-g-minor',
    newId: 'learning/keys/g-minor/intermediate',
    kind: 'superseded',
    hash: '115343dbca3e953de3120710ee6b9a64cf09ea6523273dbaa7b6d91b2165d24d',
  },
  {
    oldId: 'learning/chords/triads-g-sharp-minor',
    newId: 'learning/keys/g-sharp-minor/intermediate',
    kind: 'superseded',
    hash: '6e867e558f67ea7bafa3b6d73f8f623c5b509383ec25e3bb4bba9af28dc36e44',
  },
];
