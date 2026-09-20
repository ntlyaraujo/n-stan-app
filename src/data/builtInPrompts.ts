/**
 * The Built-in Prompt set that ships with the app (spec 3.4).
 *
 * Forty original Swedish Prompts, written for this app. Nothing here is reproduced or
 * paraphrased from any published source.
 *
 * Levels follow the spec. Beginner Prompts are deliberately written in simple Swedish —
 * present tense, high-frequency words, short sentences — because Prompts are Swedish-only
 * and a beginner Prompt whose own grammar is the obstacle has failed at its job.
 * Intermediate Prompts use past tense and subordinate clauses; advanced Prompts ask for
 * argument, hypotheticals and abstraction.
 *
 * Every Prompt is a suggestion, never an assignment, and every one invites the writer to
 * say something true about their own life rather than to drill a form.
 *
 * NOTE ON TYPES: the shared domain types are being defined on a parallel branch, so the
 * types below are a deliberately minimal *local* placeholder carrying only what spec 3.4
 * requires (text, level, origin) plus a stable id. A later ticket reconciles them with the
 * shared domain `Prompt` type; the data below should survive that unchanged.
 */

export type PromptLevel = 'beginner' | 'intermediate' | 'advanced'

export type PromptOrigin = 'built-in' | 'custom'

export interface Prompt {
  /** Stable across app versions: it is what an attached Prompt is stored by. */
  id: string
  /** The Prompt itself, in Swedish. */
  text: string
  level: PromptLevel
  origin: PromptOrigin
}

export const builtInPrompts: Prompt[] = [
  // Beginner — present tense, everyday words, short sentences.
  {
    id: 'builtin-beginner-01',
    text: 'Berätta om din morgon. Vad gör du först?',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-02',
    text: 'Vad äter du till frukost? Beskriv din mat.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-03',
    text: 'Beskriv ditt rum. Vad finns på bordet?',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-04',
    text: 'Vilka bor i ditt hem? Skriv några meningar om dem.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-05',
    text: 'Vad gör du på helgen? Skriv tre saker.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-06',
    text: 'Beskriv din väg till jobbet eller skolan.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-07',
    text: 'Vilket väder tycker du om? Varför?',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-08',
    text: 'Beskriv en person som du tycker om.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-09',
    text: 'Vad har du i din väska idag?',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-10',
    text: 'Vilken mat lagar du ofta? Skriv hur du gör.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-11',
    text: 'Vad gör dig glad? Skriv om tre saker.',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-12',
    text: 'Beskriv din stad. Vad finns nära ditt hus?',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-13',
    text: 'Vad gör du när du är trött?',
    level: 'beginner',
    origin: 'built-in',
  },
  {
    id: 'builtin-beginner-14',
    text: 'Vilken dag i veckan är bäst för dig? Varför?',
    level: 'beginner',
    origin: 'built-in',
  },

  // Intermediate — past tense and subordinate clauses.
  {
    id: 'builtin-intermediate-01',
    text: 'Berätta om något du gjorde förra helgen som du inte hade planerat.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-02',
    text: 'Beskriv en dag som blev helt annorlunda än du hade tänkt dig.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-03',
    text: 'Hur kändes det första gången du var ensam i en ny stad? Berätta vad du gjorde.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-04',
    text: 'Skriv om en person som har betytt mycket för dig, och förklara varför.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-05',
    text: 'Berätta om ett misstag du gjorde och vad du lärde dig av det.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-06',
    text: 'Beskriv en måltid som du minns tydligt. Var var du, och vem var med?',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-07',
    text: 'Vad höll du på med för fem år sedan? Hur skiljer det sig från nu?',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-08',
    text: 'Skriv om en vana som du har ändrat, och berätta hur det gick till.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-09',
    text: 'Berätta om ett samtal som du fortfarande tänker på.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-10',
    text: 'Beskriv en plats som du har lämnat och som du saknar.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-11',
    text: 'Vad var du rädd för som barn? Vad tycker du om det idag?',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-12',
    text: 'Skriv om en gång när du ändrade dig om någonting viktigt.',
    level: 'intermediate',
    origin: 'built-in',
  },
  {
    id: 'builtin-intermediate-13',
    text: 'Berätta om en helt vanlig dag som ändå blev viktig för dig.',
    level: 'intermediate',
    origin: 'built-in',
  },

  // Advanced — argument, hypotheticals, abstraction.
  {
    id: 'builtin-advanced-01',
    text: 'Vilken övertygelse har du som de flesta i din omgivning inte delar? Försvara den.',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-02',
    text: 'Om du fick bestämma en enda regel som alla måste följa, vilken skulle det bli, och vilka problem skulle den skapa?',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-03',
    text: 'Argumentera mot en åsikt som du själv har haft länge.',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-04',
    text: 'Vad är skillnaden mellan att vara ärlig och att vara hänsynslös? Ge exempel ur ditt eget liv.',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-05',
    text: 'Hur mycket av den du är idag skulle finnas kvar om du hade vuxit upp på ett annat språk?',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-06',
    text: 'Går det att förstå en kultur utan att kunna dess språk? Motivera ditt svar.',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-07',
    text: 'Beskriv ett beslut som du ångrar, men argumentera för att det ändå var rimligt utifrån det du visste då.',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-08',
    text: 'Vad betyder frihet för dig i praktiken, inte i teorin?',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-09',
    text: 'Om du skulle förklara ditt arbete för någon som lever om hundra år, vad skulle vara svårast att göra begripligt?',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-10',
    text: 'Vilket råd ger du ofta till andra men följer aldrig själv? Varför är det så?',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-11',
    text: 'Finns det situationer där en lögn är det mest ansvarsfulla valet? Resonera dig fram till ett svar.',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-12',
    text: 'Hur förändras ett minne varje gång du berättar det? Vad säger det om vad sanning är?',
    level: 'advanced',
    origin: 'built-in',
  },
  {
    id: 'builtin-advanced-13',
    text: 'Om tio år läser du det här igen. Vad hoppas du att du inte längre bryr dig om?',
    level: 'advanced',
    origin: 'built-in',
  },
]
