import { bytesToHex, isReservedPrefix, normalizeHex } from './crypto'

// Hex alphabet is 0-9 + a-f. "Funky" words use leet substitutions so they render as hex:
//   o -> 0   i/l -> 1   z -> 2   s -> 5   t -> 7   g -> 6
// Letters without a readable hex-ish substitution are skipped instead of forcing noisy glyph soup.
// Every literal below is already the final shipped hex string; inline comments document the source word when helpful.

const CLASSIC_MEMES = [
  '07',
  '0ace',
  '0bad',
  '0badc0de',
  '0dd',
  '0ddf00d',
  '0defaced',
  '0ff1ce',
  '1ace',
  '1bad',
  '1badb002',
  '1ced',
  '1ce5',
  '1cefac',
  '1dea',
  '1eed',
  '1face',
  'ab1e',
  'ac1d',
  'aced',
  'add1c7ed',
  'baad',
  'baadf00d',
  'bad',
  'badc0de',
  'bada55',
  'ba5ed',
  'babe',
  'bead',
  'bead5',
  'beaded',
  'beadface',
  'beef',
  'beefed',
  'beefcafe',
  'bed',
  'bedface',
  'b01dface',
  'b01dfade',
  'cab',
  'cabbed',
  'cafe',
  'cafed00d',
  'cafebabe',
  'ca11ed',
  'ca5cade',
  'c0de',
  'c0dec',
  'c0ded',
  'c0ffee',
  'c001cafe',
  'cade',
  'dead',
  'deadbeef',
  'deaf',
  'decaf',
  'decafbad',
  'decade',
  'deface',
  'defaced',
  'def1aced',
  'efface',
  'effaced',
  'fab',
  'face',
  'facade',
  'fade',
  'faded',
  'f00d',
  'f0e',
  'fee1',
  'feed',
  'feedface',
  'fee1dead',
  'f1a7',
  'f1e5',
  'fed',
  '5afe',
  '5ca1d',
  '5eed',
  '5eedc0de',
  '5ea1ed',
]

const FOOD_AND_DRINK = [
  'a1e', // ale
  'a1e5', // ales
  'a1011', // aioli
  'ba6e1', // bagel
  'ba6e15', // bagels
  'ba511', // basil
  'ba5111c', // basilic
  'b0ba', // boba
  'cabba6e', // cabbage
  'caca0', // cacao
  'cafe',
  'cafe5', // cafes
  'c1aba77a', // ciabatta
  'c0c0a', // cocoa
  'c01a', // cola
  'da7e', // date
  'da7e5', // dates
  'decaf',
  'decaf5', // decafs
  'ed1b1e', // edible
  'fa1afe1', // falafel
  'fe7a', // feta
  'f16', // fig
  'f11e7', // filet
  'f111e7', // fillet
  '6e1a71', // gelati
  '6e1a70', // gelato
  '1a551', // lassi
  '5a1ad', // salad
  '5a1ad5', // salads
  '5a15a', // salsa
  '5a17', // salt
  '5a6e', // sage
  '7ea', // tea
  '7ea5', // teas
  '7ac0', // taco
  '7ac05', // tacos
  '70a57', // toast
  '70ffee', // toffee
  'be7e1', // betel
  'bee7', // beet
  'bee75', // beets
  'b15c0771', // biscotti
  'b15c077e', // biscotte
  'f0cacc1a', // focaccia
]

const TECH_AND_CRYPTO = [
  'b17', // bit
  'b175', // bits
  'b17e', // bite
  'b17e5', // bites
  'b10b', // blob
  'b007', // boot
  'b0075', // boots
  'b007ab1e', // bootable
  'c1a55', // class
  'c1a55e5', // classes
  'c0de',
  'c0dec',
  'c0ded',
  'c0de5', // codes
  'c0deba5e', // codebase
  'da7a', // data
  'da7aba5e', // database
  'da7a5e7', // dataset
  'da7afeed', // datafeed
  'dea110c', // dealloc
  'dec0de', // decode
  'dec1de', // decide
  'ded1ca7e', // dedicate
  'de1e7e', // delete
  'd16e57', // digest
  'd1617', // digit
  'd1617a1', // digital
  'd16175', // digits
  'ed17', // edit
  'ed175', // edits
  'e1ec7', // elect
  'e11de', // elide
  'f11e', // file
  'f11e5', // files
  'f11ed', // filed
  'f111', // fill
  'f17', // fit
  'f177ed', // fitted
  'f100d', // flood
  'f01d', // fold
  'f01ded', // folded
  '617', // git
  '6175', // gits
  '1d1e', // idle
  '10ad', // load
  '10aded', // loaded
  '10ca1', // local
  '1061c', // logic
  '106', // log
  '1065', // logs
  '106f11e', // logfile
  '5ca1e', // scale
  '5ca1ed', // scaled
  '5eed', // seed
  '5eed5', // seeds
  '511ce', // slice
  '511ced', // sliced
  '57a7e', // state
  '7ab1e', // table
  '7ab1e5', // tables
  '7e57', // test
  '7e57ca5e', // testcase
  'b17f1e1d', // bitfield
  'd1a1', // dial
  'ca11', // call
  'ca11ed', // called
  'c17e', // cite
  'c17e5', // cites
]

const NAMES_AND_PEOPLE = [
  'abe',
  'ada',
  'ade',
  'ad11', // adil
  'ad1a1', // adlai
  'a1', // al
  'a1f', // alf
  'a11ce', // alice
  'a11da', // alida
  'a115a', // alisa
  'a111e', // allie
  'bea',
  'be11a', // bella
  'be115', // bells
  'be1a', // bela
  'be11e', // belle
  'b0b', // bob
  'b0bb1e', // bobbie
  'b111', // bill
  'b1111e', // billie
  'ca1eb', // caleb
  'ca5e', // case
  'ce1e57e', // celeste
  'ce11a', // celia
  'cec111a', // cecilia
  'c11ff', // cliff
  'c01e', // cole
  'da1e', // dale
  'deb',
  'deb1', // debi
  'debb1e', // debbie
  'de1', // del
  'edd1e', // eddie
  'e11', // eli
  'e11a5', // elias
  'e1107', // eliot
  'e11107', // elliot
  'e111077', // elliott
  'e15a', // elsa
  'fe11ce', // felice
  '6a11', // gail
  '6a1e', // gale
  '6e0ff', // geoff
  '6161', // gigi
  '611', // gil
  '611e5', // giles
  '15aac', // isaac
  '15abe1', // isabel
  '15abe11e', // isabelle
  '1e1f', // leif
  '1e11a', // leila
  '1e0', // leo
  '1e5', // les
  '1e511e', // leslie
  '111a', // lila
  '115a', // lisa
  '112', // liz
  '112a', // liza
  '01af', // olaf
  '01e6', // oleg
  '010f', // olof
  '5aad', // saad
  '5a1', // sal
  '5c07', // scot
  '5c077', // scott
  '5eda7', // sedat
  '51d', // sid
  '50f1a', // sofia
  '7a1', // tai / tal
  '7a0', // tao
  '7a17', // tait
  '7ad', // tad
  '7ed', // ted
  '70b1a5', // tobias
  '70dd', // todd
]

const FEELINGS_AND_STATES = [
  'ab1e', // able
  'a6ed', // aged
  'a6e1e55', // ageless
  'a611e', // agile
  'bad',
  'baff1ed', // baffled
  'ba1d', // bald
  'ba5e', // base
  'ba5ed', // based
  'ba51c', // basic
  'b01d', // bold
  'c01d', // cold
  'da7ed', // dated
  'dead',
  'deaf',
  'd0c11e', // docile
  'ea5ed', // eased
  'ed1f1ed', // edified
  'effaced',
  'e1a7ed', // elated
  'e117e', // elite
  'faded',
  'fa7a1', // fatal
  'fa7ed', // fated
  'feeb1e', // feeble
  'f17', // fit
  'f1a7', // flat
  '61ad', // glad
  '1d1e', // idle
  '1ced', // iced
  '1dea1', // ideal
  '0dd', // odd
  '01d', // old
  '5afe',
  '5a7ed', // sated
  '5eda7e', // sedate
  '5eda7ed', // sedated
  '5011d', // solid
  '57a1e', // stale
  '57a1d', // staid
  '5701c', // stoic
  '57011d', // stolid
  '571ff', // stiff
  'da2ed', // dazed
  'daf7', // daft
  '5a6e', // sage
  'fac11e', // facile
]

const ACTIONS_AND_VERBS = [
  'ac7', // act
  'add',
  'added',
  'a1d', // aid
  'a1ded', // aided
  'ba17', // bait
  'ba175', // baits
  'bea7', // beat
  'bea75', // beats
  'b1d', // bid
  'b1de', // bide
  'b17e', // bite
  'b17e5', // bites
  'b007', // boot
  'b0075', // boots
  'ca11', // call
  'ca11ed', // called
  'c17e', // cite
  'c17e5', // cites
  'c0de',
  'c0ded',
  'c0de5', // codes
  'da7e', // date
  'da7e5', // dates
  'dec0de', // decode
  'dec1de', // decide
  'ded1ca7e', // dedicate
  'deed',
  'deed5', // deeds
  'de1e7e', // delete
  'd1a1', // dial
  'd1ce', // dice
  'd1ced', // diced
  'd16e57', // digest
  'd1e', // die
  'ed17', // edit
  'ed175', // edits
  'efface',
  'effaced',
  'e1ec7', // elect
  'e11de', // elide
  'fade',
  'faded',
  'feed',
  'fee1', // feel
  'f1e1d', // field
  'f11e', // file
  'f11ed', // filed
  'f111', // fill
  'f17', // fit
  'f177ed', // fitted
  'f100d', // flood
  'f01d', // fold
  'f01ded', // folded
  '60ad', // goad
  '1ead', // lead
  '1ead5', // leads
  '1ea5e', // lease
  '10ad', // load
  '10de', // lode
  '5ea1', // seal
  '5ea1ed', // sealed
  '5ea7', // seat
  '5eed', // seed
  '5eed5', // seeds
  '5e7', // set
  '51ed', // sled
  '511de', // slide
  '511ce', // slice
  '511ced', // sliced
  '57a6e', // stage
  '57a6ed', // staged
  '57a7e', // state
  '57ea1', // steal
  '7a6', // tag
  '7a57e', // taste
  '7ea5e', // tease
  '71de', // tide
  '70a57', // toast
  '707e', // tote
  '707e5', // totes
]

const ANIMALS = [
  'ba55', // bass
  'bea61e', // beagle
  'bee',
  'bee5', // bees
  'bee71e', // beetle
  'b0a', // boa
  'ca1f', // calf
  'ca7', // cat
  'ca771e', // cattle
  'c1cada', // cicada
  'c0d', // cod
  'c017', // colt
  'c0175', // colts
  'd06', // dog
  'd0e', // doe
  'ea61e', // eagle
  'ee1', // eel
  'ee15', // eels
  'f0a1', // foal
  '60a7', // goat
  '6ee5e', // geese
  '5ea1', // seal
  '570a7', // stoat
  '70ad', // toad
  '70ad5', // toads
]

const POP_CULTURE_AND_FUN = [
  'e1f', // elf
  '1ee7', // leet
  '1ee75', // leets
  'b055', // boss
  'b055ed', // bossed
  'ace',
  'ace5', // aces
  'babe',
  'babe5', // babes
  'b1ade', // blade
  'b1a2e', // blaze
  'd1ce', // dice
  'fae',
  'fab1e', // fable
  'fab1ed', // fabled
  'facade',
  '6a1a', // gala
  '61ee', // glee
  '5a6a', // saga
  '57a6e', // stage
  '57a6ed', // staged
  '7a1e', // tale
  '7a1e5', // tales
  '70ffee', // toffee
  '70a57', // toast
  'bea57', // beast
  'bea75', // beats
  'e117e', // elite
  'c1a55', // class
  'dec0de', // decode
  'c0dec', // codec
  'c0da', // coda
  '1d01', // idol
  '616', // gig
  '6165', // gigs
]

const MISC_SHORT_GEMS = [
  'ab',
  'ad',
  'ae',
  'be',
  'ce',
  'ed',
  'fa',
  'fe',
  'ace',
  'ac7', // act
  'add',
  'a6e', // age
  'a1d', // aid
  'a1e', // ale
  'bad',
  'bae',
  'ba6', // bag
  'ba7', // bat
  'bed',
  'bee',
  'b16', // big
  'b17', // bit
  'cab',
  'cad',
  'ca7', // cat
  'c0d', // cod
  'dab',
  'dad',
  'd16', // dig
  'd1e', // die
  'd0c', // doc
  'd0e', // doe
  'd07', // dot
  'ee1', // eel
  'e1f', // elf
  'fab',
  'fad',
  'fed',
  'f16', // fig
  'f17', // fit
  '6ab', // gab
  '6a6', // gag
  '6e1', // gel
  '61f', // gif
  '616', // gig
  '617', // git
  '60d', // god
  '600', // goo
  '1ce', // ice
  '1a6', // lag
  '1ea', // lea
  '1ed', // led
  '1ee', // lee
  '1e6', // leg
  '1e7', // let
  '117', // lit
  '5ad', // sad
  '5a6e', // sage
  '5ea', // sea
  '5ee', // see
  '5e7', // set
  '517', // sit
  '7a6', // tag
  '7ea', // tea
  '7ee', // tee
  '70e', // toe
]

const RAW_FUNKY_PREFIXES = [
  ...CLASSIC_MEMES,
  ...FOOD_AND_DRINK,
  ...TECH_AND_CRYPTO,
  ...NAMES_AND_PEOPLE,
  ...FEELINGS_AND_STATES,
  ...ACTIONS_AND_VERBS,
  ...ANIMALS,
  ...POP_CULTURE_AND_FUN,
  ...MISC_SHORT_GEMS,
]

export const FUNKY_PREFIXES = Array.from(new Set(
  RAW_FUNKY_PREFIXES
    .map((value) => normalizeHex(value))
    .filter((value) => value.length >= 1 && value.length <= 8 && !isReservedPrefix(value)),
))

function randomIndex(limit) {
  if (limit <= 1) return 0
  const values = crypto.getRandomValues(new Uint32Array(1))
  return values[0] % limit
}

function shufflePrefixes(prefixes) {
  const out = [...prefixes]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function pickRandomFunkyPrefixes(count, options = {}) {
  const exclude = Array.isArray(options.exclude) ? options.exclude : [options.exclude]
  const excluded = new Set(exclude.filter(Boolean).map((value) => normalizeHex(value)))
  return shufflePrefixes(FUNKY_PREFIXES.filter((prefix) => !excluded.has(prefix))).slice(0, count)
}

export function createPreviewPublicKeyHex(prefixHex) {
  const prefix = normalizeHex(prefixHex)
  const tailLength = Math.max(0, 64 - prefix.length)
  const tail = bytesToHex(crypto.getRandomValues(new Uint8Array(Math.ceil(tailLength / 2)))).slice(0, tailLength)
  return `${prefix}${tail}`
}
