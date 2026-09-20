/**
 * Recorded Karp v7 responses, captured with `curl` against the live API on
 * 2026-09-20 and committed verbatim. The Dictionary tests run against these,
 * never against the network, so the suite passes offline.
 *
 * Each file is the exact body returned for the request `buildLookupUrl` makes,
 * except `talaUnfiltered`, which drops the part-of-speech clause on purpose to
 * record what the analyzed `baseform` match pulls in when nothing filters it.
 *
 * To re-record one:
 *   API=https://spraakbanken4.it.gu.se/karp/v7
 *   curl -sS -G "$API/query/saldom" --data 'size=50' --data-urlencode \
 *     'q=and(equals|baseform|"bok"||equals|partOfSpeech|nn)' \
 *     | python3 -m json.tool --indent 2 > src/dictionary/fixtures/bok-nn.json
 */

import abborrliknandeAv from './fixtures/abborrliknande-av.json'
import abstinensbesvarNn from './fixtures/abstinensbesvar-nn.json'
import acceptNn from './fixtures/accept-nn.json'
import andasVb from './fixtures/andas-vb.json'
import beundraVb from './fixtures/beundra-vb.json'
import bokNn from './fixtures/bok-nn.json'
import drickaVb from './fixtures/dricka-vb.json'
import husNn from './fixtures/hus-nn.json'
import kopaVb from './fixtures/kopa-vb.json'
import lysterVb from './fixtures/lyster-vb.json'
import notFoundNn from './fixtures/not-found-nn.json'
import skammasVb from './fixtures/skammas-vb.json'
import storAv from './fixtures/stor-av.json'
import syVb from './fixtures/sy-vb.json'
import talaUnfiltered from './fixtures/tala-unfiltered.json'
import talaVb from './fixtures/tala-vb.json'
import vagaVb from './fixtures/vaga-vb.json'
import vetaVb from './fixtures/veta-vb.json'

export const FIXTURES = {
  /** *abborrliknande* — invariable adjective, a single `invar` row. */
  abborrliknandeAv,
  /** *abstinensbesvär* — plural-only noun, `inherent: ["p"]`, no singular. */
  abstinensbesvarNn,
  /** *accept* — sense 1 vacillates between both genders, sense 2 is *en*. */
  acceptNn,
  /** *andas* — deponent, `vb_1s_andas`: only *s*-forms, so no Forms at all. */
  andasVb,
  /** *beundra* — `vb_1a_beundra`, Conjugation Group 1. */
  beundraVb,
  /** *bok* — the spec's worked noun, plus the beech-tree sense `bok..nn.2`. */
  bokNn,
  /** *dricka* — `vb_4a_dricka`, Conjugation Group 4. */
  drickaVb,
  /** *hus* — `inherent: ["n"]`, an *ett* word. */
  husNn,
  /** *köpa* — `vb_2a_ansöka`, preterite *köpte*: Swedish 2b under SALDO's 2a. */
  kopaVb,
  /** *lyster* — `vb_0d_lyster`, defective: one row, no group. */
  lysterVb,
  /** A lemma SALDO does not have: HTTP 200, `total: 0`. */
  notFoundNn,
  /** *skämmas* — `vb_2s_trivas`, deponent group 2: no preterite to split on. */
  skammasVb,
  /** *stor* — the spec's worked adjective, `av_2_ung`. */
  storAv,
  /** *sy* — `vb_3a_sy`, Conjugation Group 3. */
  syVb,
  /** *tala* with no part-of-speech clause: fifteen `vbm` phrases, then `tala..vb.1`. */
  talaUnfiltered,
  /** *tala* — the spec's worked verb, `vb_va_tala`, duplicate preterite rows. */
  talaVb,
  /** *väga* — three senses across `vb_2a_viga`, `vb_1a_laga` and `vb_2m_väga`. */
  vagaVb,
  /** *veta* — `vb_om_veta`, irregular: no group. */
  vetaVb,
} as const
