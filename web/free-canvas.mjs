// Thenvio Canvas 0.6 — a thinking canvas.
// Notes glide (one rAF loop tweens every position), connect by dragging a dot, and the canvas
// suggests the next thought, the next move, tools worth connecting and the strongest route.
// All suggestions come from deterministic local heuristics in core/. No model calls, no network.
import {makeIdea,readIdeaGraph,deleteIdeaBranch,unlinkIdeaBranches,ideaContext} from './core/idea-graph.mjs';
import {prepareBoard,moveBoardNodes,addBoardNode,updateBoardText,updateBoardMeta,visibleBoardEdges,freeSlots,tidyLayout,setLinkType,connectNotes,detachNote,BOARD_W,BOARD_H,CARD_W,CARD_H} from './core/board.mjs';
import {thinkNext,THINK_MODES} from './core/brainstorm.mjs';
import {coachGraph,nodeAdvice,inferKind,detectLocale,isPlaceholder,skillBrief,defaultModeFor} from './core/coach.mjs';
import {analyzeFutures,countFutures,findForks,decisionRecord,confidenceLabel} from './core/futures.mjs';
import {markdownToCanvas,canvasToMarkdown,BRAIN_FOLDERS} from './core/brain.mjs';
import {createBrainSync} from './brain-sync.mjs';
import {simulateSwarm,swarmNotes} from './core/swarm.mjs';
import {thinkRequest,applyThinkResult,readGoal,withGoal,THINK_SCHEMA} from './core/think.mjs';
import {runThink,setKey,hasKey} from './ai-think.mjs';
import {readGithubBrain,setToken} from './github-brain.mjs';
import {detectLocalBrain,createLocalBrain,isCloud,cloudBrainId,createCloudBrainId,cloudInfo} from './local-brain.mjs';

const $=s=>document.querySelector(s);
const el=(tag,cls='',txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined&&txt!==null)e.textContent=String(txt);return e;};
const svgEl=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
const button=(cls,txt,fn)=>{const b=el('button',cls,txt);b.type='button';if(fn)b.addEventListener('click',fn);return b;};
const KEY='thenvio-ideas-portfolio-v1',MAX=50;
const MIN_SCALE=.3,MAX_SCALE=1.9;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const reducedMotion=()=>document.documentElement.dataset.motion==='off'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone=()=>window.matchMedia('(max-width: 690px)').matches;
const KIND_GLYPH={idea:'◆',direction:'◇',question:'?',assumption:'△',experiment:'⚗',insight:'✓'};
const NOTE_KINDS=['direction','question','assumption','experiment','insight'];
const STATES=['open','exploring','supported','refuted'];

const T={
 en:{hint:'Double-click to add · Drag a dot to connect · Tab adds a branch',scan:'Scan futures',tabNote:'Note',tabCoach:'Next moves',tabFutures:'Futures',
  noteEmpty:'Select a note to shape it, or double-click the canvas to start a new one.',status:'Status',ratings:'Impact & effort',evidence:'Evidence or source',
  suggestions:'Suggestions',more:'Other angles ↻',addAll:'Add all',tools:'Tools worth connecting',toolsNote:'Suggestions only. Thenvio is not connected to these apps.',
  skill:'Founder skill for this',child:'+ Branch',detach:'Detach',copyContext:'Copy context',delete:'Delete note',coachLede:'Next best moves for this canvas',
  dockNote:'Note',dockConnect:'Connect',dockArrange:'Arrange',
  kind_idea:'Main idea',kind_direction:'Option',kind_question:'Question',kind_assumption:'Assumption',kind_experiment:'Test',kind_insight:'Insight',
  st_open:'Open',st_exploring:'Exploring',st_supported:'Supported',st_refuted:'Refuted',impact:'Impact',effort:'Effort',
  mode_explore:'Explore',mode_answer:'Answer',mode_challenge:'Challenge',mode_test:'Test',addStep:'Add as step',copySkill:'Copy skill brief',
  newThought:'New thought',rootPlaceholder:'What are you thinking about?',notePlaceholder:'Type a thought…',editTitle:'Edit note title',
  coachEmpty:'Nothing urgent. Scan futures or keep exploring.',stats:'{n} notes · {f} forks · {s} possible futures',
  scanning:'Scanning futures… {n} of {total}',bestOf:'Best of {n} futures · {score}/100 · {conf}',
  noForksTitle:'No forks yet',noForksBody:'A fork is a note with two or more options (kind “Option”). Each combination of choices is one possible future.',
  futuresIntro:'Thenvio combines every choice on the canvas into scenarios, checks them against your evidence, ratings and conflicts, and shows the strongest route.',
  scanNow:'Scan futures',viable:'viable',blocked:'blocked',exhaustive:'every combination checked',guided:'guided search over the strongest {k}',
  winning:'Winning route',why:'Why this route',weakest:'Weakest link',ifFalse:'If false: −{d} pts',planB:'Plan B',everything:'Every route depends on it.',
  nextMove:'Next move',record:'Record decision',showRoute:'Show route',rescan:'Scan again',others:'Other routes',blockedRoutes:'Blocked routes',
  reason_refuted:'refuted: “{t}”',reason_conflict:'conflict: “{a}” × “{b}”',reason_option:'option refuted: “{t}”',
  rel_relates:'Relates',rel_supports:'Supports',rel_conflicts:'Conflicts',remove:'Remove',detachBranch:'Detach branch',
  connected:'Connected.',attached:'Note joined the branch.',exists:'Already connected.',chooseFirst:'Choose the first note.',chooseSecond:'Now choose the note to connect to.',
  linkCancelled:'Connecting cancelled.',deleted:'Deleted {n} — Ctrl/⌘ Z to undo.',arranged:'Arranged.',decisionSaved:'Decision recorded on the canvas.',
  copied:'Copied.',clipboardBlocked:'Clipboard blocked.',pillNext:'Next',pillDetails:'Details',noSuggestions:'No new angles here. Write your own with Tab.',
  allBlocked:'Every route is blocked',score:'score',saveFailed:'Unable to save. Export your canvas as JSON.',canvasExported:'Canvas exported.',
  canvasImported:'Canvas imported.',importFailed:'Import failed: {e}',tooLarge:'File is too large.',maxCanvases:'Maximum 50 canvases.',ideasAdded:'Ideas added to canvas.',
  nothingToImport:'Nothing to import.',brain:'Brain',menuNew:'New canvas',menuImport:'Import file…',menuExport:'Export JSON',menuAi:'Think with AI…',menuSettings:'Appearance',menuClassic:'More tools',
  more:'More',connectTo:'Connect to…',panelNote:'Note',panelFutures:'Futures',panelBrain:'Shared brain',panelAi:'Think it through',
  brainLede:'One repo, plain text. Your team and your agents work from the same files.',brainConnect:'Connect a folder',brainDownload:'Download brain (.zip)',brainOpen:'Open a brain folder',
  brainHow:'Put it on GitHub',brainTraits:'Lightweight · Full history · Backed up · Free',brainReconnect:'Reconnect “{name}”',brainDisconnect:'Disconnect folder',
  brainOff:'Not connected. Canvases stay in this browser until you connect a folder or download the brain.',brainSynced:'Saved to <b>{name}</b> at {time} · {n} files. Commit and push to share.',
  brainSaving:'Saving to <b>{name}</b>…',brainNeedsAccess:'<b>{name}</b> needs your permission again.',brainError:'Could not write to the folder: {e}',
  brainUnsupported:'This browser cannot write to folders. Download the brain and commit it, or open a folder to read its canvases.',
  brainImported:'{n} canvas(es) read from the brain.',brainNothing:'No canvases found in product-data/ideas/.',
  brainStep1:'Create a private repository on GitHub.',brainStep2:'Clone it and connect that folder here — or unzip the download into it.',brainStep3:'Save history: <code>git add . && git commit -m "Update brain" && git push</code>',brainStep4:'Point your agents at the repo. They read <code>AGENTS.md</code> and the same files.',
  welcomeHint:'Enter saves · Tab adds a branch',think:'Think',panelThink:'Think it through',goalLabel:'Goal — where do you want to get?',goalPlaceholder:'e.g. 100 paying customers in 6 months',
  keyLabel:'Your Anthropic API key',keyNote:'Billed to your own account. Kept only in this tab’s memory and sent only to api.anthropic.com when you press Think.',thinkRun:'Think it through',
  noKey:'No API key? Use any assistant',noKeyNote:'Copy the prompt, paste it into Claude or ChatGPT, then paste the JSON answer here.',copyPrompt:'Copy the prompt',pasteJson:'Paste the JSON answer',addToCanvas:'Add to canvas',close:'Close',
  scopeAll:'Thinks about the whole canvas{ctx}.',scopeNote:'Focuses on “{t}”{ctx}.',scopeCtx:' with your shared brain as context',thinking:'Thinking it through — questions, alternatives, the best route… (can take a minute)',
  thinkDone:'{n} notes added. Ranking every combination…',errNoKey:'Paste your API key first.',errBadKey:'The API key was rejected.',errRate:'Rate limited — try again in a moment.',
  errRefusal:'Claude declined this request.',errTooLong:'The answer was cut off — try a narrower focus.',errNet:'Could not reach the API: {e}',
  bestRoute:'Best route',questionsTitle:'Questions that would change the decision',altsTitle:'Alternatives',risk:'Risk',planB:'Plan B',
  thinkLede:'The thinking happens in your own Claude or ChatGPT — on your subscription.',wayMcp:'Thenvio inside Claude or ChatGPT',copyAsk:'Copy the request for the chat',
  copyClaudeConfig:'Claude Desktop setup',copyMcpUrl:'ChatGPT setup',wayChat:'No setup: copy, paste, paste back',wayKey:'Optional: run it here with an API key',
  mcpLocal:'Connected to the local brain ({dir}). In a chat that has Thenvio, paste the request: the chat brainstorms, the notes appear here live and the canvas opens in the chat.',
  mcpStatic:'Run Thenvio locally (npm start) to use it inside Claude Desktop, Claude Code or ChatGPT. The copy-paste way below works everywhere.',
  askText:'Use Thenvio. Brainstorm the canvas “{title}”{goal}: read it with thenvio_canvas, look for genuinely different alternatives, the questions that would change the decision and the cheapest tests, then save it with thenvio_brainstorm and tell me the best route and the first test.',
  askGoal:' with the goal “{goal}”',configCopied:'Claude Desktop config copied — paste it into Settings → Developer → Edit config and restart Claude.',
  chatgptCopied:'ChatGPT steps copied.',localSynced:'Live with the local brain <b>{dir}</b>{time}. Claude and ChatGPT edits appear here automatically.',localError:'Local brain: {e}',liveUpdated:'Canvas updated from the brain.',
  connectorLabel:'Your connector URL',copy:'Copy',connectorSecret:'This URL is the key to your brain — anyone who has it can read and change it. Keep it private.',createConnector:'Create my connector',
  cloudCreate:'Create your personal MCP connector. Paste it once into Claude or ChatGPT — from then on you brainstorm in the chat and this canvas updates by itself.',
  cloudLede:'Your connector is live. Add it once, then ask in any chat.',stepClaude:'<b>Claude</b>: Settings → Connectors → Add custom connector → paste the URL.',
  stepChatGPT:'<b>ChatGPT</b>: Settings → Apps & Connectors → add a custom connector (MCP) → paste the URL, no authentication.',stepAsk:'Then ask: “Use Thenvio and brainstorm my idea … with the goal …”.',connectorCopied:'Connector URL copied.',
  swarmTitle:'Crowd (simulation)',swarmIntro:'Hundreds of synthetic people with different traits react to your options and influence each other. It shows who would plausibly take each option up, how sure that is — and who rejects what, and why.',
  swarmRun:'Simulate the crowd',swarmAgain:'Another crowd ↻',swarmAdd:'Add objections to the canvas',swarmTop:'Most taken up: “{t}” — {p}% after {r} rounds',swarmTip:' (tipping point in round {n})',
  swarmNone:'Nobody took any option up — the crowd sees too little benefit or too much friction.',swarmObj:'Main objection: {o} ({p}%)',swarmUndecided:'{p}% stayed undecided.',swarmAdded:'{n} crowd objections added as questions.',
  swarmConflict:'Value and uptake disagree: the futures scan favours “{f}”, the crowd takes up “{c}”. Find what makes the valuable option as easy to take up — or test whether the easy one is valuable enough.',
  swarmUpdated:'Crowd updated: {v}',swarmStale:'The canvas changed since this crowd ran.',swarmRefresh:'Update crowd',swarmFriends:'+{p} pts through friends (from round {n})',swarmUnrated:'not rated — guess',swarmTestHow:'Ask 5 people about a recent real situation, not an opinion. Pass if at least 3 do not raise this objection or say what would remove it.',
  cert_clear:'Clear lead',cert_close:'Close call',cert_unclear:'Too early',cert_none:'No uptake',crowdHud:'Crowd · {c} · “{t}” {r}',crowdHudNone:'Crowd · nobody would take any option up',crowdRunning:'{n} synthetic people react…',
  swarmNote:'Adoption, not value: a widely taken option can still be the wrong one. Check the objections with real people.',
  ghTitle:'Read from GitHub',ghConnect:'Connect GitHub (read)',ghReading:'Reading {repo}…',ghRead:'Read <b>{repo}</b> ({branch}): {n} canvas(es), {c} context file(s).',ghError:'GitHub: {e}',bodyPlaceholder:'Context, details, why it matters…',evidencePlaceholder:'Interview note, link, number…',invalidAi:'Invalid AI response: {e}',undoEmpty:'Nothing to undo.'},
 pl:{hint:'Kliknij dwukrotnie, by dodać · Przeciągnij kropkę, by połączyć · Tab dodaje gałąź',scan:'Skanuj przyszłości',tabNote:'Notatka',tabCoach:'Co dalej',tabFutures:'Przyszłości',
  noteEmpty:'Wybierz notatkę, aby ją rozwinąć, albo kliknij dwukrotnie canvas, by zacząć nową.',status:'Status',ratings:'Wpływ i wysiłek',evidence:'Dowód lub źródło',
  suggestions:'Podpowiedzi',more:'Inne kąty ↻',addAll:'Dodaj wszystkie',tools:'Narzędzia do podłączenia',toolsNote:'Tylko sugestie. Thenvio nie jest połączone z tymi aplikacjami.',
  skill:'Skill do tej notatki',child:'+ Gałąź',detach:'Odłącz',copyContext:'Kopiuj kontekst',delete:'Usuń notatkę',coachLede:'Najlepsze następne ruchy',
  dockNote:'Notatka',dockConnect:'Połącz',dockArrange:'Ułóż',
  kind_idea:'Główny pomysł',kind_direction:'Opcja',kind_question:'Pytanie',kind_assumption:'Założenie',kind_experiment:'Test',kind_insight:'Wniosek',
  st_open:'Otwarte',st_exploring:'Badam',st_supported:'Potwierdzone',st_refuted:'Obalone',impact:'Wpływ',effort:'Wysiłek',
  mode_explore:'Odkrywaj',mode_answer:'Odpowiedz',mode_challenge:'Podważ',mode_test:'Testuj',addStep:'Dodaj jako krok',copySkill:'Kopiuj brief skilla',
  newThought:'Nowa myśl',rootPlaceholder:'O czym myślisz?',notePlaceholder:'Wpisz myśl…',editTitle:'Edytuj tytuł notatki',
  coachEmpty:'Nic pilnego. Przeskanuj przyszłości albo myśl dalej.',stats:'{n} notatek · {f} rozwidleń · {s} możliwych przyszłości',
  scanning:'Skanuję przyszłości… {n} z {total}',bestOf:'Najlepsza z {n} przyszłości · {score}/100 · {conf}',
  noForksTitle:'Jeszcze brak rozwidleń',noForksBody:'Rozwidlenie to notatka z co najmniej dwiema opcjami (typ „Opcja”). Każda kombinacja wyborów to jedna możliwa przyszłość.',
  futuresIntro:'Thenvio łączy każdy wybór na canvasie w scenariusze, sprawdza je względem dowodów, ocen i konfliktów i pokazuje najmocniejszą ścieżkę.',
  scanNow:'Skanuj przyszłości',viable:'możliwych',blocked:'zablokowanych',exhaustive:'sprawdzono każdą kombinację',guided:'przeszukano najmocniejsze {k}',
  winning:'Zwycięska ścieżka',why:'Dlaczego ta ścieżka',weakest:'Najsłabsze ogniwo',ifFalse:'Jeśli fałszywe: −{d} pkt',planB:'Plan B',everything:'Każda ścieżka od tego zależy.',
  nextMove:'Następny ruch',record:'Zapisz decyzję',showRoute:'Pokaż ścieżkę',rescan:'Skanuj ponownie',others:'Inne ścieżki',blockedRoutes:'Zablokowane ścieżki',
  reason_refuted:'obalone: „{t}”',reason_conflict:'konflikt: „{a}” × „{b}”',reason_option:'obalona opcja: „{t}”',
  rel_relates:'Powiązane',rel_supports:'Wspiera',rel_conflicts:'Wyklucza',remove:'Usuń',detachBranch:'Odłącz gałąź',
  connected:'Połączono.',attached:'Notatka dołączyła do gałęzi.',exists:'Już połączone.',chooseFirst:'Wybierz pierwszą notatkę.',chooseSecond:'Teraz wybierz notatkę do połączenia.',
  linkCancelled:'Anulowano łączenie.',deleted:'Usunięto: {n} — Ctrl/⌘ Z cofa.',arranged:'Uporządkowano.',decisionSaved:'Decyzja zapisana na canvasie.',
  copied:'Skopiowano.',clipboardBlocked:'Schowek zablokowany.',pillNext:'Dalej',pillDetails:'Szczegóły',noSuggestions:'Brak nowych kątów. Dopisz własny klawiszem Tab.',
  allBlocked:'Wszystkie ścieżki są zablokowane',score:'ocena',saveFailed:'Nie można zapisać. Wyeksportuj canvas do JSON.',canvasExported:'Wyeksportowano canvas.',
  canvasImported:'Zaimportowano canvas.',importFailed:'Import nieudany: {e}',tooLarge:'Plik jest za duży.',maxCanvases:'Maksymalnie 50 canvasów.',ideasAdded:'Dodano pomysły na canvas.',
  nothingToImport:'Nic do zaimportowania.',brain:'Mózg',menuNew:'Nowy canvas',menuImport:'Importuj plik…',menuExport:'Eksportuj JSON',menuAi:'Pomyśl z AI…',menuSettings:'Wygląd',menuClassic:'Więcej narzędzi',
  more:'Więcej',connectTo:'Połącz z…',panelNote:'Notatka',panelFutures:'Przyszłości',panelBrain:'Wspólny mózg',panelAi:'Rozkmina',
  brainLede:'Jedno repo, zwykły tekst. Twój zespół i Twoi agenci pracują na tych samych plikach.',brainConnect:'Połącz folder',brainDownload:'Pobierz mózg (.zip)',brainOpen:'Otwórz folder mózgu',
  brainHow:'Wrzuć na GitHuba',brainTraits:'Lekkie · Pełna historia · Kopia zapasowa · Za darmo',brainReconnect:'Połącz ponownie „{name}”',brainDisconnect:'Odłącz folder',
  brainOff:'Nie połączono. Canvasy zostają w tej przeglądarce, dopóki nie połączysz folderu albo nie pobierzesz mózgu.',brainSynced:'Zapisano w <b>{name}</b> o {time} · {n} plików. Zrób commit i push, by udostępnić.',
  brainSaving:'Zapisuję w <b>{name}</b>…',brainNeedsAccess:'<b>{name}</b> potrzebuje ponownie Twojej zgody.',brainError:'Nie można zapisać w folderze: {e}',
  brainUnsupported:'Ta przeglądarka nie zapisuje do folderów. Pobierz mózg i zrób commit albo otwórz folder, by wczytać canvasy.',
  brainImported:'Wczytano z mózgu: {n} canvas(y).',brainNothing:'Brak canvasów w product-data/ideas/.',
  brainStep1:'Załóż prywatne repozytorium na GitHubie.',brainStep2:'Sklonuj je i połącz ten folder tutaj — albo rozpakuj do niego pobrany plik.',brainStep3:'Zapisz historię: <code>git add . && git commit -m "Aktualizacja mózgu" && git push</code>',brainStep4:'Wskaż agentom repo. Czytają <code>AGENTS.md</code> i te same pliki.',
  welcomeHint:'Enter zapisuje · Tab dodaje gałąź',think:'Pomyśl',panelThink:'Rozkmina',goalLabel:'Cel — dokąd chcesz dojść?',goalPlaceholder:'np. 100 płacących klientów w 6 miesięcy',
  keyLabel:'Twój klucz API Anthropic',keyNote:'Rozliczane na Twoim koncie. Trzymany tylko w pamięci tej karty i wysyłany wyłącznie do api.anthropic.com po kliknięciu.',thinkRun:'Rozkmiń to',
  noKey:'Nie masz klucza? Użyj dowolnego asystenta',noKeyNote:'Skopiuj prompt, wklej do Claude albo ChatGPT, potem wklej tu odpowiedź JSON.',copyPrompt:'Kopiuj prompt',pasteJson:'Wklej odpowiedź JSON',addToCanvas:'Dodaj na canvas',close:'Zamknij',
  scopeAll:'Myśli o całym canvasie{ctx}.',scopeNote:'Skupia się na „{t}”{ctx}.',scopeCtx:' z Twoim wspólnym mózgiem jako kontekstem',thinking:'Rozkminiam — pytania, alternatywy, najlepsza droga… (może potrwać minutę)',
  thinkDone:'Dodano notatek: {n}. Porównuję wszystkie kombinacje…',errNoKey:'Najpierw wklej klucz API.',errBadKey:'Klucz API został odrzucony.',errRate:'Limit zapytań — spróbuj za chwilę.',
  errRefusal:'Claude odmówił tego zapytania.',errTooLong:'Odpowiedź została ucięta — zawęź temat.',errNet:'Nie udało się połączyć z API: {e}',
  bestRoute:'Najlepsza droga',questionsTitle:'Pytania, które zmieniłyby decyzję',altsTitle:'Alternatywy',risk:'Ryzyko',planB:'Plan B',
  thinkLede:'Rozkmina dzieje się w Twoim Claude albo ChatGPT — na Twojej subskrypcji.',wayMcp:'Thenvio w Claude albo ChatGPT',copyAsk:'Kopiuj polecenie do czatu',
  copyClaudeConfig:'Ustaw w Claude Desktop',copyMcpUrl:'Ustaw w ChatGPT',wayChat:'Bez instalacji: kopiuj, wklej, wklej z powrotem',wayKey:'Opcjonalnie: uruchom tutaj z kluczem API',
  mcpLocal:'Połączono z lokalnym mózgiem ({dir}). W czacie z Thenvio wklej polecenie: czat robi rozkminę, notatki pojawiają się tu na żywo, a canvas otwiera się w czacie.',
  mcpStatic:'Uruchom Thenvio lokalnie (npm start), żeby używać go w Claude Desktop, Claude Code albo ChatGPT. Sposób „kopiuj-wklej” poniżej działa wszędzie.',
  askText:'Użyj Thenvio. Rozkmiń canvas „{title}”{goal}: przeczytaj go przez thenvio_canvas, poszukaj naprawdę różnych alternatyw, pytań, które zmieniłyby decyzję, i najtańszych testów, potem zapisz to przez thenvio_brainstorm i powiedz mi, jaka jest najlepsza droga i pierwszy test.',
  askGoal:' z celem „{goal}”',configCopied:'Skopiowano konfigurację Claude Desktop — wklej w Ustawienia → Developer → Edit config i zrestartuj Claude.',
  chatgptCopied:'Skopiowano kroki dla ChatGPT.',localSynced:'Na żywo z lokalnym mózgiem <b>{dir}</b>{time}. Zmiany z Claude i ChatGPT pojawiają się tu same.',localError:'Lokalny mózg: {e}',liveUpdated:'Canvas zaktualizowany z mózgu.',
  connectorLabel:'Twój adres connectora',copy:'Kopiuj',connectorSecret:'Ten adres to klucz do Twojego mózgu — każdy, kto go ma, może go czytać i zmieniać. Nie udostępniaj go.',createConnector:'Utwórz mój connector',
  cloudCreate:'Utwórz osobisty connector MCP. Wklejasz go raz w Claude albo ChatGPT — od tej pory rozkminiasz w czacie, a ten canvas aktualizuje się sam.',
  cloudLede:'Twój connector działa. Dodaj go raz, potem po prostu pisz w czacie.',stepClaude:'<b>Claude</b>: Ustawienia → Connectors → Dodaj własny connector → wklej adres.',
  stepChatGPT:'<b>ChatGPT</b>: Ustawienia → Aplikacje i connectory → dodaj własny connector (MCP) → wklej adres, bez uwierzytelniania.',stepAsk:'Potem napisz: „Użyj Thenvio i rozkmiń mój pomysł … z celem …”.',connectorCopied:'Skopiowano adres connectora.',
  swarmTitle:'Tłum (symulacja)',swarmIntro:'Setki syntetycznych osób o różnych cechach reagują na Twoje opcje i wpływają na siebie nawzajem. Widać, kto prawdopodobnie wziąłby każdą opcję, na ile to pewne — i kto, co i dlaczego odrzuca.',
  swarmRun:'Symuluj tłum',swarmAgain:'Inny tłum ↻',swarmAdd:'Dodaj obiekcje na canvas',swarmTop:'Najchętniej brane: „{t}” — {p}% po {r} rundach',swarmTip:' (przełamanie w rundzie {n})',
  swarmNone:'Nikt nie wziął żadnej opcji — tłum widzi za małą korzyść albo za duży wysiłek.',swarmObj:'Główna obiekcja: {o} ({p}%)',swarmUndecided:'{p}% zostało niezdecydowanych.',swarmAdded:'Dodano obiekcje tłumu jako pytania: {n}.',
  swarmConflict:'Wartość i adopcja się rozjeżdżają: skan przyszłości stawia na „{f}”, a tłum bierze „{c}”. Znajdź, co uczyni wartościową opcję równie łatwą do wzięcia — albo sprawdź, czy ta łatwa daje dość korzyści.',
  swarmUpdated:'Tłum zaktualizowany: {v}',swarmStale:'Canvas zmienił się od tej symulacji.',swarmRefresh:'Odśwież tłum',swarmFriends:'+{p} pkt przez znajomych (od rundy {n})',swarmUnrated:'bez oceny — zgadywanie',swarmTestHow:'Zapytaj 5 osób o ostatnią prawdziwą sytuację, nie o opinię. Sukces, jeśli co najmniej 3 nie zgłaszają tej obiekcji albo mówią, co by ją usunęło.',
  cert_clear:'Wyraźny lider',cert_close:'Na styk',cert_unclear:'Za wcześnie',cert_none:'Brak chętnych',crowdHud:'Tłum · {c} · „{t}” {r}',crowdHudNone:'Tłum · nikt nie wziąłby żadnej opcji',crowdRunning:'{n} syntetycznych osób reaguje…',
  swarmNote:'To adopcja, nie wartość: chętnie brana opcja nadal może być zła. Sprawdź obiekcje z prawdziwymi ludźmi.',
  ghTitle:'Czytaj z GitHuba',ghConnect:'Połącz GitHub (odczyt)',ghReading:'Czytam {repo}…',ghRead:'Wczytano <b>{repo}</b> ({branch}): canvasy: {n}, pliki kontekstu: {c}.',ghError:'GitHub: {e}',bodyPlaceholder:'Kontekst, szczegóły, dlaczego to ważne…',evidencePlaceholder:'Notatka z rozmowy, link, liczba…',invalidAi:'Nieprawidłowa odpowiedź AI: {e}',undoEmpty:'Nie ma czego cofnąć.'}
};

function portfolioLoad(){
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   const data=JSON.parse(raw);
   if(data?.format!=='thenvio-ideas-collection-v1'||!Array.isArray(data.graphs)||!data.graphs.length||data.graphs.length>MAX)throw Error('Invalid collection');
   const graphs=data.graphs.map(readIdeaGraph).map(prepareBoard);
   return {format:data.format,graphs,activeId:graphs.some(g=>g.id===data.activeId)?data.activeId:graphs[0].id};
  }
 }catch(error){console.warn('Previous canvas data cannot be restored:',error);}
 const initial=prepareBoard(makeIdea('Untitled idea'));
 return {format:'thenvio-ideas-collection-v1',graphs:[initial],activeId:initial.id};
}

export function initFreeCanvas({notice=()=>{}}={}){
 const view=$('#view-branches'),viewport=$('#boardViewport'),surface=$('#boardSurface'),nodesLayer=$('#boardNodes'),ghostLayer=$('#boardGhosts');
 const edgeLayer=$('#boardEdgeLayer'),ghostEdgeLayer=$('#boardGhostEdges'),draft=$('#boardDraft'),panel=$('#boardPanel');
 const hud=$('#boardHud'),hudText=$('#boardHudText'),edgeMenu=$('#boardEdgeMenu'),pill=$('#boardCoachPill');
 let portfolio=portfolioLoad();
 let selected=null,linkSource=null,history=[],future=[],lastCoalesce=null,lastCommitAt=0;
 let inline=null,dragging=false,panelMode=null;const skipped=new Set();
 let thinkMode=null,thinkRound=0,ghostList=[];
 let futures=null,futuresSig='',highlight=null,scanTimer=null,scanning=false;
 let locale='en',firstPaint=true,needsCamera=true,coachTimer=null,lastTap={id:null,t:0},lastBgTap={t:0,x:0,y:0},lastPointerType='mouse';
 const cam={x:0,y:0,scale:1};let camAnim=0;
 const disp=new Map(),override=new Map(),direct=new Set(),spawnFrom=new Map(),cards=new Map(),edges=new Map(),ghostEls=new Map();
 let frameReq=0,lastFrame=0;
 const t=(key,vars={})=>String((T[locale]&&T[locale][key])??T.en[key]??key).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
 const graph=()=>portfolio.graphs.find(g=>g.id===portfolio.activeId);
 const nodeById=id=>graph().nodes.find(n=>n.id===id)||null;
 const selectedNode=()=>selected?nodeById(selected):null;
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(portfolio));}catch{notice(t('saveFailed'));}brain?.schedule();const g=graph();if(local&&g&&!(isPlaceholder(g.title)&&g.nodes.length===1))local.schedule(g);};
 let brain=null;
 const signature=g=>g.nodes.map(n=>[n.id,n.parentId,n.kind,n.status,n.impact||0,n.effort||0,n.free?1:0,n.title].join('\u0001')).join('\u0002')+'|'+g.links.map(l=>l.from+'>'+l.to+':'+(l.type||'')).join(',');
 const fmtBig=v=>{try{return BigInt(v).toLocaleString(locale==='pl'?'pl-PL':'en-US');}catch{return String(v);}};
 function refreshLocale(){
  const nav=(navigator.language||'en').toLowerCase().startsWith('pl')?'pl':'en';
  const g=graph(),text=g.nodes.filter(n=>!isPlaceholder(n.title)).slice(0,12).map(n=>n.title).join(' ');
  locale=text?detectLocale(text,nav):nav;
  view.querySelectorAll('[data-i18n]').forEach(node=>{const value=T[locale][node.dataset.i18n];if(value)node.textContent=value;});
  $('#boardFutures').setAttribute('aria-label',T[locale].scan);
  $('#boardBrain').setAttribute('aria-label',T[locale].panelBrain);
 }

 // ── History ──
 function replaceGraph(next){portfolio.graphs=portfolio.graphs.map(g=>g.id===next.id?next:g);}
 function commit(next,{select,coalesce=null}={}){
  const before=graph();
  if(!next||next===before){if(select!==undefined){selected=select;render();}return false;}
  const now=Date.now();
  const merge=coalesce&&coalesce===lastCoalesce&&(coalesce.startsWith('create:')||now-lastCommitAt<2500);
  if(!merge){history.push(before);if(history.length>80)history.shift();}
  future=[];lastCoalesce=coalesce;lastCommitAt=now;
  replaceGraph(next);
  if(select!==undefined)selected=select;
  if(highlight&&!scanning)clearHighlight(false);
  if(swarmLayer.childElementCount)clearSwarm();
  swarmAfterCommit();
  persist();render();
  return true;
 }
 function restore(isUndo){
  finishInline(true);
  const source=isUndo?history:future;
  if(!source.length){if(isUndo)notice(t('undoEmpty'));return;}
  const before=graph(),next=source.pop();
  (isUndo?future:history).push(before);
  lastCoalesce=null;replaceGraph(next);
  if(selected&&!next.nodes.some(n=>n.id===selected))selected=null;
  clearHighlight(false);persist();render();
 }
 function discardCreation(id){
  const prev=history.at(-1);
  if(prev&&!prev.nodes.some(n=>n.id===id)&&graph().nodes.some(n=>n.id===id)){
   history.pop();lastCoalesce=null;
   const parent=nodeById(id)?.parentId||null;
   replaceGraph(prev);selected=parent&&prev.nodes.some(n=>n.id===parent)?parent:null;persist();render();
  }else render();
 }

 // ── Camera ──
 function applyCamera(){
  surface.style.transform='translate3d('+cam.x+'px,'+cam.y+'px,0) scale('+cam.scale+')';
  viewport.style.backgroundPosition=cam.x+'px '+cam.y+'px';
  viewport.style.backgroundSize=(28*cam.scale)+'px '+(28*cam.scale)+'px';
  $('#boardZoomValue').textContent=Math.round(cam.scale*100)+'%';
  $('#boardZoomOut').disabled=cam.scale<=MIN_SCALE+.001;
  $('#boardZoomIn').disabled=cam.scale>=MAX_SCALE-.001;
 }
 function animateCamera(target,ms=460){
  cancelAnimationFrame(camAnim);
  if(reducedMotion()||ms<=0){Object.assign(cam,target);applyCamera();return;}
  const from={...cam},start=performance.now();
  const step=now=>{
   const k=Math.min(1,(now-start)/ms),e=1-Math.pow(1-k,4);
   cam.x=from.x+(target.x-from.x)*e;cam.y=from.y+(target.y-from.y)*e;cam.scale=from.scale+(target.scale-from.scale)*e;
   applyCamera();if(k<1)camAnim=requestAnimationFrame(step);
  };
  camAnim=requestAnimationFrame(step);
 }
 const focusY=()=>isPhone()&&!panel.hidden?.24:.46;
 function centerOn(id,{animate=true,scale=cam.scale}={}){
  const n=nodeById(id);if(!n)return;
  const target={scale,x:viewport.clientWidth*.5-(n.x+CARD_W/2)*scale,y:viewport.clientHeight*focusY()-(n.y+CARD_H/2)*scale};
  animate?animateCamera(target):(Object.assign(cam,target),applyCamera());
 }
 function fitTo(ids=null,{animate=true}={}){
  const list=ids?graph().nodes.filter(n=>ids.includes(n.id)):graph().nodes;
  if(!list.length)return;
  const minX=Math.min(...list.map(n=>n.x)),maxX=Math.max(...list.map(n=>n.x+CARD_W));
  const minY=Math.min(...list.map(n=>n.y)),maxY=Math.max(...list.map(n=>n.y+CARD_H));
  const vw=viewport.clientWidth,vh=viewport.clientHeight*(isPhone()&&!panel.hidden&&!panel.classList.contains('is-peek')?.42:1);
  const scale=clamp(Math.min((vw-90)/(maxX-minX+40),(vh-150)/(maxY-minY+60),1.15),MIN_SCALE,1.15);
  const target={scale,x:(vw-(minX+maxX)*scale)/2,y:(vh-(minY+maxY)*scale)/2+(isPhone()?0:8)};
  animate?animateCamera(target):(Object.assign(cam,target),applyCamera());
 }
 // Pan just enough to bring a note into view, so the surrounding context stays where it was.
 function ensureVisible(id){
  const n=nodeById(id);if(!n)return;
  const m=48,vw=viewport.clientWidth,vh=viewport.clientHeight*(isPhone()&&!panel.hidden?.45:1)-(isPhone()?70:84);
  const sx=n.x*cam.scale+cam.x,sy=n.y*cam.scale+cam.y,w=CARD_W*cam.scale,h=CARD_H*cam.scale;
  let dx=0,dy=0;
  if(sx<m)dx=m-sx;else if(sx+w>vw-m)dx=vw-m-(sx+w);
  if(sy<m)dy=m-sy;else if(sy+h>vh-m)dy=vh-m-(sy+h);
  if(dx||dy)animateCamera({scale:cam.scale,x:cam.x+dx,y:cam.y+dy},380);
 }
 // After a selection, bring the note and its suggestion fan into view (zooming out only on phones).
 function revealSelection(){
  const n=selectedNode();if(!n)return;
  const rects=[{x:n.x,y:n.y},...ghostList.map(g=>({x:g.x,y:g.y}))];
  const minX=Math.min(...rects.map(r=>r.x)),maxX=Math.max(...rects.map(r=>r.x+CARD_W));
  const minY=Math.min(...rects.map(r=>r.y)),maxY=Math.max(...rects.map(r=>r.y+CARD_H));
  const m=isPhone()?16:48,vw=viewport.clientWidth,vh=viewport.clientHeight*(isPhone()&&!panel.hidden?.45:1)-(isPhone()?150:84);
  let scale=cam.scale;
  if(isPhone()){const fitScale=Math.min((vw-2*m)/(maxX-minX),(vh-2*m)/(maxY-minY));if(fitScale<scale)scale=clamp(fitScale,.5,scale);}
  const sx=minX*scale+cam.x,ex=maxX*scale+cam.x,sy=minY*scale+cam.y,ey=maxY*scale+cam.y;
  let x=cam.x,y=cam.y;
  if(scale!==cam.scale){x=(vw-(minX+maxX)*scale)/2;y=m+40-minY*scale;}
  else{
   if(ex-sx<=vw-2*m){if(sx<m)x+=m-sx;else if(ex>vw-m)x-=ex-(vw-m);}
   else x+=m-sx;
   if(ey-sy<=vh-2*m){if(sy<m)y+=m-sy;else if(ey>vh-m)y-=ey-(vh-m);}
  }
  if(x!==cam.x||y!==cam.y||scale!==cam.scale)animateCamera({x,y,scale},420);
 }
 function zoomAt(factor,px=viewport.clientWidth/2,py=viewport.clientHeight/2,animate=false){
  const scale=clamp(cam.scale*factor,MIN_SCALE,MAX_SCALE),ratio=scale/cam.scale;
  const target={scale,x:px-(px-cam.x)*ratio,y:py-(py-cam.y)*ratio};
  animate?animateCamera(target,240):(cancelAnimationFrame(camAnim),Object.assign(cam,target),applyCamera());
 }
 function worldFromClient(cx,cy){
  const r=viewport.getBoundingClientRect();
  return {x:(cx-r.left-cam.x)/cam.scale,y:(cy-r.top-cam.y)/cam.scale};
 }

 // ── Motion loop: displayed positions glide toward model (or drag override) positions ──
 function kick(){if(!frameReq)frameReq=requestAnimationFrame(frame);}
 function frame(now){
  frameReq=0;
  const dt=Math.min(64,lastFrame?now-lastFrame:16);lastFrame=now;
  const k=reducedMotion()?1:1-Math.exp(-dt/80);
  const dirty=new Set();let moving=false;
  for(const n of graph().nodes){
   const d=disp.get(n.id),entry=cards.get(n.id);if(!d||!entry)continue;
   const target=override.get(n.id)||n;
   const dx=target.x-d.x,dy=target.y-d.y;
   if(Math.abs(dx)>.35||Math.abs(dy)>.35){
    if(direct.has(n.id)){d.x=target.x;d.y=target.y;}else{d.x+=dx*k;d.y+=dy*k;moving=true;}
    dirty.add(n.id);
   }else if(d.x!==target.x||d.y!==target.y){d.x=target.x;d.y=target.y;dirty.add(n.id);}
   if(dirty.has(n.id)||entry.needsPos){entry.el.style.transform='translate3d('+d.x+'px,'+d.y+'px,0)';entry.needsPos=false;}
  }
  if(dirty.size){updateEdges(dirty);updateGhostEdges();}
  if(moving||override.size)kick();else lastFrame=0;
 }

 // ── Notes ──
 function createCard(n){
  const node=el('div','board-note');node.dataset.id=n.id;node.tabIndex=0;node.setAttribute('role','button');
  const card=el('div','board-note-card');
  const meta=el('div','board-note-meta'),glyph=el('span','board-note-glyph'),kind=el('span','board-note-kind'),pips=el('span','board-note-pips'),crowdPct=el('span','board-note-crowdpct'),status=el('span','board-note-status');
  meta.append(glyph,kind,pips,crowdPct,status);
  const crowdBar=el('div','board-note-crowd');crowdBar.append(el('i'));
  const title=el('div','board-note-title'),body=el('div','board-note-body');
  card.append(meta,title,body,crowdBar);
  const plus=button('board-note-plus','+');
  plus.setAttribute('aria-label','Add a branch or drag to connect');plus.title='Click: new branch · Drag: connect';
  plus.addEventListener('pointerdown',e=>startConnectDrag(n.id,e));
  plus.addEventListener('click',e=>e.stopPropagation());
  plus.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();addChild(n.id);}});
  node.append(card,plus);
  node.addEventListener('pointerdown',e=>startNodeDrag(n.id,e));
  node.addEventListener('dblclick',e=>{if(e.target.closest('.board-note-plus,textarea')||lastPointerType!=='mouse')return;e.stopPropagation();startInline(n.id);});
  node.addEventListener('keydown',e=>{
   if(e.target!==node)return;
   if((e.key==='Enter'||e.key===' ')&&selected!==n.id){e.preventDefault();e.stopPropagation();select(n.id,{focus:true});}
  });
  return {el:node,card,glyph,kind,pips,crowdPct,crowdBar,status,title,body,sig:null,needsPos:true};
 }
 function fillCard(entry,n,g){
  const root=n.id===g.rootId;
  entry.glyph.textContent=KIND_GLYPH[n.kind]||'◇';
  entry.kind.textContent=t('kind_'+n.kind);
  entry.status.className='board-note-status '+n.status;
  entry.status.hidden=root;
  entry.status.title=t('st_'+n.status);
  entry.pips.replaceChildren();
  if(n.kind==='direction'&&(n.impact||n.effort)){
   for(let i=1;i<=5;i++){const p=el('i',i<=(n.impact||0)?'on':'');entry.pips.append(p);}
   entry.pips.title=t('impact')+' '+(n.impact||'–')+'/5 · '+t('effort')+' '+(n.effort||'–')+'/5';
  }
  const placeholder=isPlaceholder(n.title);
  entry.title.textContent=placeholder?(root?t('rootPlaceholder'):t('notePlaceholder')):n.title;
  entry.body.textContent=(n.description||'').split('\n').find(line=>line.trim())||'';
  entry.el.setAttribute('aria-label',t('kind_'+n.kind)+': '+(placeholder?t('newThought'):n.title)+(root?'':', '+t('st_'+n.status)));
 }
 function syncNodes(){
  const g=graph(),seen=new Set();
  for(const n of g.nodes){
   seen.add(n.id);
   let entry=cards.get(n.id);
   if(!entry){
    entry=createCard(n);cards.set(n.id,entry);nodesLayer.append(entry.el);
    const from=spawnFrom.get(n.id);spawnFrom.delete(n.id);
    disp.set(n.id,from?{...from}:{x:n.x,y:n.y});
    entry.el.style.transform='translate3d('+disp.get(n.id).x+'px,'+disp.get(n.id).y+'px,0)';
    if(!firstPaint&&!reducedMotion()){entry.el.classList.add('is-entering');setTimeout(()=>entry.el.classList.remove('is-entering'),520);}
   }
   if(inline?.id!==n.id){const sig=[n.title,n.description,n.kind,n.status,n.impact||0,n.effort||0,locale,n.id===g.rootId].join('\u0001');if(sig!==entry.sig){fillCard(entry,n,g);entry.sig=sig;}}
   const c=entry.el.classList;
   c.toggle('root',n.id===g.rootId);c.toggle('is-selected',n.id===selected);c.toggle('is-link-source',n.id===linkSource);
   c.toggle('refuted',n.status==='refuted');c.toggle('is-placeholder',isPlaceholder(n.title));c.toggle('is-lit',!!highlight?.ids.has(n.id));
  }
  for(const [id,entry] of cards)if(!seen.has(id)){
   cards.delete(id);disp.delete(id);override.delete(id);
   if(reducedMotion())entry.el.remove();
   else{entry.el.classList.add('is-leaving');setTimeout(()=>entry.el.remove(),210);}
  }
  kick();
 }

 // ── Edges ──
 function geometry(a,b){
  const ax=a.x+CARD_W/2,ay=a.y+CARD_H/2,bx=b.x+CARD_W/2,by=b.y+CARD_H/2,dx=bx-ax,dy=by-ay;
  let sx,sy,tx,ty,c1x,c1y,c2x,c2y;
  if(Math.abs(dx)>=Math.abs(dy)*1.15){
   sx=dx>0?a.x+CARD_W:a.x;sy=ay;tx=dx>0?b.x:b.x+CARD_W;ty=by;
   const c=Math.max(36,Math.abs(tx-sx)*.46)*(dx>0?1:-1);c1x=sx+c;c1y=sy;c2x=tx-c;c2y=ty;
  }else{
   sx=ax;sy=dy>0?a.y+CARD_H:a.y;tx=bx;ty=dy>0?b.y:b.y+CARD_H;
   const c=Math.max(30,Math.abs(ty-sy)*.46)*(dy>0?1:-1);c1x=sx;c1y=sy+c;c2x=tx;c2y=ty-c;
  }
  return {d:'M'+sx.toFixed(1)+' '+sy.toFixed(1)+' C'+c1x.toFixed(1)+' '+c1y.toFixed(1)+' '+c2x.toFixed(1)+' '+c2y.toFixed(1)+' '+tx.toFixed(1)+' '+ty.toFixed(1),
   mx:.125*sx+.375*c1x+.375*c2x+.125*tx,my:.125*sy+.375*c1y+.375*c2y+.125*ty};
 }
 function focusEdges(){
  const g=graph(),set=new Set();
  if(!selected)return set;
  const byId=new Map(g.nodes.map(n=>[n.id,n]));
  let n=byId.get(selected);
  while(n&&n.parentId&&n.free!==true){set.add('p:'+n.parentId+'>'+n.id);n=byId.get(n.parentId);}
  for(const k of g.nodes)if(k.parentId===selected&&k.free!==true)set.add('p:'+selected+'>'+k.id);
  for(const l of g.links)if(l.from===selected||l.to===selected)set.add('l:'+l.from+'>'+l.to);
  return set;
 }
 function syncEdges(){
  const g=graph(),seen=new Set(),focus=focusEdges();
  for(const e of visibleBoardEdges(g)){
   const key=(e.type==='parent'?'p:':'l:')+e.from+'>'+e.to;seen.add(key);
   let ent=edges.get(key);
   if(!ent){
    const group=svgEl('g'),line=svgEl('path',{class:'board-edge-line'}),hit=svgEl('path',{class:'board-edge-hit'}),mark=svgEl('text',{class:'board-edge-mark'});
    group.append(line,mark,hit);edgeLayer.append(group);
    ent={key,group,line,hit,mark};
    hit.addEventListener('pointerdown',ev=>ev.stopPropagation());
    hit.addEventListener('click',ev=>{ev.stopPropagation();openEdgeMenu(ent,ev.clientX,ev.clientY);});
    edges.set(key,ent);
   }
   Object.assign(ent,{from:e.from,to:e.to,type:e.type,relation:e.relation||null});
   ent.group.setAttribute('class','board-edge '+(e.type==='link'?'link '+ent.relation:'parent')+(focus.has(key)?' is-focus':'')+(highlight&&highlight.ids.has(e.from)&&highlight.ids.has(e.to)?' is-lit':''));
   ent.mark.textContent=ent.relation==='conflicts'?'×':'';
  }
  for(const [key,ent] of edges)if(!seen.has(key)){ent.group.remove();edges.delete(key);}
  updateEdges(null);
 }
 function updateEdges(dirty){
  for(const ent of edges.values()){
   if(dirty&&!dirty.has(ent.from)&&!dirty.has(ent.to))continue;
   const a=disp.get(ent.from),b=disp.get(ent.to);if(!a||!b)continue;
   const geo=geometry(a,b);
   ent.line.setAttribute('d',geo.d);ent.hit.setAttribute('d',geo.d);
   if(ent.relation==='conflicts'){ent.mark.setAttribute('x',geo.mx.toFixed(1));ent.mark.setAttribute('y',geo.my.toFixed(1));}
  }
 }
 function openEdgeMenu(ent,cx,cy){
  closeEdgeMenu();
  const r=viewport.getBoundingClientRect();
  edgeMenu.replaceChildren();
  if(ent.type==='link'){
   for(const type of ['relates','supports','conflicts']){
    const b=button('',t('rel_'+type),()=>{closeEdgeMenu();try{commit(setLinkType(graph(),ent.from,ent.to,type));}catch(err){notice(err.message);}});
    b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String(ent.relation===type));edgeMenu.append(b);
   }
   const rm=button('danger',t('remove'),()=>{closeEdgeMenu();commit(unlinkIdeaBranches(graph(),ent.from,ent.to));});rm.setAttribute('role','menuitem');edgeMenu.append(rm);
  }else{
   const d=button('',t('detachBranch'),()=>{closeEdgeMenu();try{commit(detachNote(graph(),ent.to),{select:ent.to});}catch(err){notice(err.message);}});d.setAttribute('role','menuitem');edgeMenu.append(d);
  }
  edgeMenu.hidden=false;
  const w=edgeMenu.offsetWidth,h=edgeMenu.offsetHeight;
  edgeMenu.style.left=clamp(cx-r.left-w/2,8,r.width-w-8)+'px';edgeMenu.style.top=clamp(cy-r.top-h-12,8,r.height-h-8)+'px';
  edgeMenu.querySelector('button')?.focus({preventScroll:true});
 }
 function closeEdgeMenu(){edgeMenu.hidden=true;}

 // ── Ghost suggestions next to the selected note ──
 function suggestionsFor(node,count){
  const mode=thinkMode||defaultModeFor(node.kind);
  try{return thinkNext(graph(),node.id,{mode,round:thinkRound,locale,count});}catch{return [];}
 }
 function syncGhosts(){
  const node=selectedNode();
  const show=node&&!inline&&!dragging&&!highlight&&!linkSource&&!isPlaceholder(node.title);
  const list=show?suggestionsFor(node,3):[];
  let slots=[];
  if(list.length){try{slots=freeSlots(graph(),node.id,list.length);}catch{slots=[];}}
  ghostList=list.slice(0,slots.length).map((card,i)=>({card,parentId:node.id,x:slots[i].x,y:slots[i].y}));
  const seen=new Set();
  ghostList.forEach((g,i)=>{
   const key=g.parentId+':'+g.card.id+':'+g.card.title;
   seen.add(key);
   let ent=ghostEls.get(key);
   if(!ent){
    const b=el('button','board-ghost');b.type='button';
    const card=el('div','board-ghost-card');card.style.setProperty('--delay',(i*55)+'ms');
    const meta=el('div','board-note-meta');meta.append(el('span','board-note-glyph',KIND_GLYPH[g.card.kind]),el('span','',t('kind_'+g.card.kind)));
    card.append(meta,el('div','board-note-title',g.card.title),el('div','board-note-body',g.card.question),el('span','board-ghost-add','+'));
    b.append(card);
    b.setAttribute('aria-label',t('suggestions')+': '+g.card.title);
    b.addEventListener('pointerdown',ev=>ev.stopPropagation());
    b.addEventListener('click',ev=>{ev.stopPropagation();const cur=ghostList.find(x=>x.card.id===g.card.id);if(cur)addSuggestion(cur.parentId,cur.card,{x:cur.x,y:cur.y},true);});
    b.addEventListener('mouseenter',()=>setHoverGhost(g.card.id));b.addEventListener('mouseleave',()=>setHoverGhost(null));
    ghostLayer.append(b);ent={el:b,cardId:g.card.id};ghostEls.set(key,ent);
   }
   ent.el.style.transform='translate3d('+g.x+'px,'+g.y+'px,0)';
  });
  for(const [id,ent] of ghostEls)if(!seen.has(id)){ent.el.remove();ghostEls.delete(id);}
  updateGhostEdges();
 }
 function updateGhostEdges(){
  ghostEdgeLayer.replaceChildren();
  for(const g of ghostList){const a=disp.get(g.parentId);if(a)ghostEdgeLayer.append(svgEl('path',{class:'board-ghost-edge',d:geometry(a,g).d}));}
 }
 function setHoverGhost(id){
  for(const ent of ghostEls.values())ent.el.classList.toggle('is-hover',ent.cardId===id);
  document.querySelectorAll('.board-suggest-item').forEach(b=>b.classList.toggle('is-hover',b.dataset.card===id));
 }
 function addSuggestion(parentId,card,pos=null,inPlace=false){
  const g=graph();
  let p=pos;
  if(!p){try{p=freeSlots(g,parentId,1)[0];}catch(err){notice(err.message);return null;}}
  try{
   const made=addBoardNode(g,{title:card.title,kind:card.kind,description:card.description||'',parentId,x:p.x,y:p.y,free:false});
   const parent=disp.get(parentId);
   spawnFrom.set(made.id,inPlace||!parent?{x:p.x,y:p.y}:{x:parent.x,y:parent.y});
   commit(made.graph);
   return made.id;
  }catch(err){notice(err.message);return null;}
 }

 // ── Creating, editing, connecting ──
 function addChild(parentId,pos=null,{seed=null}={}){
  finishInline(true);
  const g=graph();
  let p;
  try{p=pos?{x:clamp(Math.round(pos.x),0,BOARD_W-CARD_W),y:clamp(Math.round(pos.y),0,BOARD_H-CARD_H)}:freeSlots(g,parentId,1)[0];}catch(err){notice(err.message);return null;}
  try{
   const made=addBoardNode(g,{title:seed?.title||t('newThought'),kind:seed?.kind||'direction',description:seed?.description||'',parentId,x:p.x,y:p.y,free:false});
   const parent=disp.get(parentId);
   spawnFrom.set(made.id,parent?{x:parent.x,y:parent.y}:p);
   commit(made.graph,{select:made.id,coalesce:seed?null:'create:'+made.id});
   ensureVisible(made.id);
   if(!seed)startInline(made.id,{isNew:true});
   return made.id;
  }catch(err){notice(err.message);return null;}
 }
 function addFree(world){
  finishInline(true);
  const p={x:clamp(Math.round(world.x-CARD_W/2),0,BOARD_W-CARD_W),y:clamp(Math.round(world.y-CARD_H/2),0,BOARD_H-CARD_H)};
  try{
   const made=addBoardNode(graph(),{title:t('newThought'),parentId:graph().rootId,x:p.x,y:p.y,free:true});
   spawnFrom.set(made.id,p);
   commit(made.graph,{select:made.id,coalesce:'create:'+made.id});
   startInline(made.id,{isNew:true});
  }catch(err){notice(err.message);}
 }
 function addSibling(id){const n=nodeById(id);if(!n)return;addChild(n.parentId||n.id);}
 function startInline(id,{isNew=false}={}){
  if(inline&&inline.id!==id)finishInline(true);
  if(inline?.id===id)return;
  const entry=cards.get(id),n=nodeById(id);if(!entry||!n)return;
  selected=id;
  const ta=el('textarea','board-note-inline');ta.maxLength=150;ta.rows=2;
  ta.value=isPlaceholder(n.title)?'':n.title;
  ta.placeholder=id===graph().rootId?t('rootPlaceholder'):t('notePlaceholder');
  ta.setAttribute('aria-label',t('editTitle'));
  inline={id,isNew,original:n.title,ta};
  entry.el.classList.add('is-editing');entry.title.replaceChildren(ta);
  entry.body.textContent=id===graph().rootId&&isPlaceholder(n.title)?t('welcomeHint'):'';
  ta.addEventListener('pointerdown',ev=>ev.stopPropagation());
  ta.addEventListener('dblclick',ev=>ev.stopPropagation());
  ta.addEventListener('keydown',ev=>{
   ev.stopPropagation();
   if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();finishInline(true,{refocus:true});}
   else if(ev.key==='Tab'&&!ev.shiftKey){ev.preventDefault();if(finishInline(true))addChild(id);}
   else if(ev.key==='Escape'){ev.preventDefault();finishInline(false,{refocus:true});}
  });
  ta.addEventListener('blur',()=>{if(inline&&inline.ta===ta)finishInline(true);});
  render();
  ta.focus({preventScroll:true});ta.select();
 }
 function finishInline(save,{refocus=false}={}){
  const st=inline;if(!st)return false;
  inline=null;
  const entry=cards.get(st.id);
  if(entry){entry.el.classList.remove('is-editing');entry.sig=null;}
  const g=graph(),n=g.nodes.find(x=>x.id===st.id);
  if(!n){render();return false;}
  const value=st.ta.value.trim().replace(/\s+/g,' ').slice(0,150);
  let ok=false;
  if(!save||!value){
   if(st.isNew&&isPlaceholder(n.title)){discardCreation(st.id);return false;}
   render();
  }else if(value===n.title){render();ok=true;}
  else{
   let next=updateBoardText(g,st.id,{title:value,description:n.description});
   if(st.id!==g.rootId&&isPlaceholder(st.original)){const kind=inferKind(value);if(kind!==n.kind)next=updateBoardMeta(next,st.id,{kind});}
   commit(next,{coalesce:st.isNew?'create:'+st.id:null});
   if(st.id===g.rootId){refreshLocale();render();}
   ok=true;
  }
  if(refocus)cards.get(st.id)?.el.focus({preventScroll:true});
  if(ok)requestAnimationFrame(()=>{if(!inline&&selected===st.id)revealSelection();});
  return ok;
 }
 function connect(a,b){
  try{
   const r=connectNotes(graph(),a,b);
   if(r.mode==='exists'){notice(t('exists'));return;}
   commit(r.graph,{select:b});
   notice(r.mode==='attached'?t('attached'):t('connected'));
  }catch(err){notice(err.message);}
 }
 function removeNode(id){
  const g=graph();if(id===g.rootId)return;
  const n=g.nodes.find(x=>x.id===id);if(!n)return;
  try{
   const next=deleteIdeaBranch(g,id);
   commit(next,{select:null});
   notice(t('deleted',{n:g.nodes.length-next.nodes.length}));
  }catch(err){notice(err.message);}
 }
 function select(id,{focus=false,keepTab=false,keepMode=false}={}){
  closeEdgeMenu();
  if(linkSource){
   if(linkSource==='__await__'){linkSource=id;selected=id;notice(t('chooseSecond'));render();return;}
   const from=linkSource;linkSource=null;
   if(from!==id)connect(from,id);else render();
   return;
  }
  if(selected!==id&&!keepMode){thinkMode=null;thinkRound=0;}
  if(inline&&inline.id!==id)finishInline(true);
  selected=id;
  if(!keepTab&&!isPhone())panelMode='note';
  render();
  if(!keepTab)revealSelection();
  if(focus)cards.get(id)?.el.focus({preventScroll:true});
 }
 function deselect(){
  finishInline(true);
  selected=null;linkSource=null;
  if(panelMode==='note')panelMode=null;
  render();
 }
 function handleNodeTap(id,pointerType){
  const now=Date.now();
  if(pointerType!=='mouse'&&lastTap.id===id&&now-lastTap.t<340){lastTap={id:null,t:0};startInline(id);return;}
  lastTap={id,t:now};
  select(id);
 }
 function navigateSpatial(key){
  const n=selectedNode();if(!n)return;
  const dir={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]}[key];
  let best=null,bestScore=Infinity;
  for(const o of graph().nodes){
   if(o.id===n.id)continue;
   const dx=o.x-n.x,dy=o.y-n.y,along=dx*dir[0]+dy*dir[1];
   if(along<=8)continue;
   const across=Math.abs(dx*dir[1])+Math.abs(dy*dir[0]);
   const score=along+across*2.2;
   if(score<bestScore){bestScore=score;best=o;}
  }
  if(best){select(best.id,{focus:true,keepTab:true});ensureVisible(best.id);}
 }

 // ── Pointer interaction ──
 function descendantsOf(id){
  const g=graph(),out=[];const stack=[id];
  while(stack.length){const cur=stack.pop();for(const n of g.nodes)if(n.parentId===cur&&n.free!==true){out.push(n.id);stack.push(n.id);}}
  return out;
 }
 function startNodeDrag(id,e){
  lastPointerType=e.pointerType||'mouse';
  if(e.button!==0||e.target.closest('button,textarea'))return;
  e.stopPropagation();
  closeEdgeMenu();
  const entry=cards.get(id),n=nodeById(id);if(!entry||!n)return;
  const origin={x:e.clientX,y:e.clientY};
  const group=e.altKey?[id]:[id,...descendantsOf(id)];
  const base=new Map(group.map(gid=>{const m=nodeById(gid);return [gid,{x:m.x,y:m.y}];}));
  let moved=false;
  try{entry.el.setPointerCapture(e.pointerId);}catch{}
  const move=ev=>{
   if(ev.pointerId!==e.pointerId)return;
   const dx=(ev.clientX-origin.x)/cam.scale,dy=(ev.clientY-origin.y)/cam.scale;
   if(!moved&&Math.hypot(dx,dy)>5){
    moved=true;dragging=true;entry.el.classList.add('is-dragging');direct.add(id);
    if(inline?.id===id)finishInline(true);
    syncGhosts();
   }
   if(moved){
    for(const [gid,b] of base)override.set(gid,{x:clamp(Math.round(b.x+dx),0,BOARD_W-CARD_W),y:clamp(Math.round(b.y+dy),0,BOARD_H-CARD_H)});
    kick();
   }
  };
  const stop=ev=>{
   if(ev.pointerId!==e.pointerId)return;
   entry.el.removeEventListener('pointermove',move);entry.el.removeEventListener('pointerup',stop);entry.el.removeEventListener('pointercancel',stop);
   entry.el.classList.remove('is-dragging');direct.delete(id);
   if(moved){
    dragging=false;
    const moves=[...base.keys()].map(gid=>({id:gid,...override.get(gid)}));
    override.clear();
    try{commit(moveBoardNodes(graph(),moves),{select:selected===id?id:selected});}catch(err){notice(err.message);render();}
   }else if(ev.type==='pointerup')handleNodeTap(id,e.pointerType||'mouse');
  };
  entry.el.addEventListener('pointermove',move);entry.el.addEventListener('pointerup',stop);entry.el.addEventListener('pointercancel',stop);
 }
 function startConnectDrag(id,e){
  if(e.button!==0)return;
  e.stopPropagation();e.preventDefault();
  lastPointerType=e.pointerType||'mouse';
  closeEdgeMenu();finishInline(true);
  const handle=e.currentTarget,origin={x:e.clientX,y:e.clientY};
  let moved=false,target=null;
  try{handle.setPointerCapture(e.pointerId);}catch{}
  const setTarget=tid=>{
   if(target===tid)return;
   if(target)cards.get(target)?.el.classList.remove('is-drop-target');
   target=tid;
   if(target)cards.get(target)?.el.classList.add('is-drop-target');
  };
  const move=ev=>{
   if(ev.pointerId!==e.pointerId)return;
   if(!moved&&Math.hypot(ev.clientX-origin.x,ev.clientY-origin.y)>6){moved=true;viewport.classList.add('is-linking');}
   if(!moved)return;
   const w=worldFromClient(ev.clientX,ev.clientY),s=disp.get(id);
   if(s)draft.setAttribute('d',geometry(s,{x:w.x-CARD_W/2,y:w.y-CARD_H/2}).d);
   const hit=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.board-note');
   setTarget(hit&&hit.dataset.id!==id?hit.dataset.id:null);
  };
  const stop=ev=>{
   if(ev.pointerId!==e.pointerId)return;
   handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',stop);handle.removeEventListener('pointercancel',stop);
   draft.setAttribute('d','');viewport.classList.remove('is-linking');
   const tid=target;setTarget(null);
   if(ev.type==='pointercancel')return;
   if(!moved){addChild(id);return;}
   if(tid){connect(id,tid);return;}
   const w=worldFromClient(ev.clientX,ev.clientY);
   addChild(id,{x:w.x-CARD_W/2,y:w.y-CARD_H/2});
  };
  handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
 }
 const pointers=new Map();let gesture=null;
 viewport.addEventListener('pointerdown',e=>{
  lastPointerType=e.pointerType||'mouse';
  if(e.target.closest('.board-note,.board-ghost,.board-dock,.board-edge-menu,.board-coach-pill,.board-hud,button,textarea,input,select'))return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  closeEdgeMenu();cancelAnimationFrame(camAnim);
  try{viewport.setPointerCapture(e.pointerId);}catch{}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1)gesture={type:'pan',x:e.clientX,y:e.clientY,camX:cam.x,camY:cam.y,moved:false};
  else if(pointers.size===2){
   const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();
   gesture={type:'pinch',dist:Math.hypot(a.x-b.x,a.y-b.y)||1,scale:cam.scale,camX:cam.x,camY:cam.y,
    mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,moved:true};
  }
 });
 viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesture.type==='pan'){
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(!gesture.moved&&Math.hypot(dx,dy)>4){gesture.moved=true;viewport.classList.add('is-panning');}
   if(gesture.moved){cam.x=gesture.camX+dx;cam.y=gesture.camY+dy;applyCamera();}
  }else if(pointers.size>=2){
   const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();
   const scale=clamp(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.dist,MIN_SCALE,MAX_SCALE);
   const mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;
   const wx=(gesture.mx-gesture.camX)/gesture.scale,wy=(gesture.my-gesture.camY)/gesture.scale;
   cam.scale=scale;cam.x=mx-wx*scale;cam.y=my-wy*scale;applyCamera();
  }
 });
 const endPointer=e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.delete(e.pointerId);
  if(pointers.size===1){const [p]=[...pointers.values()];gesture={type:'pan',x:p.x,y:p.y,camX:cam.x,camY:cam.y,moved:true};return;}
  if(pointers.size===0){
   const tap=gesture?.type==='pan'&&!gesture.moved&&e.type==='pointerup';
   gesture=null;viewport.classList.remove('is-panning');
   if(tap)backgroundTap(e);
  }
 };
 viewport.addEventListener('pointerup',endPointer);
 viewport.addEventListener('pointercancel',endPointer);
 function backgroundTap(e){
  const now=Date.now();
  if(e.pointerType!=='mouse'&&now-lastBgTap.t<340&&Math.hypot(e.clientX-lastBgTap.x,e.clientY-lastBgTap.y)<30){
   lastBgTap={t:0,x:0,y:0};addFree(worldFromClient(e.clientX,e.clientY));return;
  }
  lastBgTap={t:now,x:e.clientX,y:e.clientY};
  if(scanning)cancelScan();
  if(highlight){clearHighlight();return;}
  if(linkSource){linkSource=null;notice(t('linkCancelled'));render();return;}
  if(selected||inline)deselect();
 }
 viewport.addEventListener('dblclick',e=>{
  if(lastPointerType!=='mouse'||e.target.closest('.board-note,.board-ghost,.board-dock,.board-edge-menu,.board-coach-pill,button,textarea'))return;
  addFree(worldFromClient(e.clientX,e.clientY));
 });
 viewport.addEventListener('wheel',e=>{
  if(e.target.closest('.board-edge-menu'))return;
  e.preventDefault();closeEdgeMenu();
  const r=viewport.getBoundingClientRect();
  if(e.ctrlKey||e.metaKey)zoomAt(Math.exp(-e.deltaY*(e.deltaMode===1?.05:.0028)),e.clientX-r.left,e.clientY-r.top);
  else{cancelAnimationFrame(camAnim);const k=e.deltaMode===1?18:1;cam.x-=e.deltaX*k;cam.y-=e.deltaY*k;applyCamera();}
 },{passive:false});

 // ── Futures ──
 function setHighlight(ids,route){
  highlight=ids?{ids:new Set(ids),route:!!route}:null;
  viewport.classList.toggle('has-highlight',!!highlight);
  viewport.classList.toggle('is-route',!!highlight?.route);
  for(const [id,entry] of cards)entry.el.classList.toggle('is-lit',!!highlight?.ids.has(id));
  for(const ent of edges.values())ent.group.classList.toggle('is-lit',!!highlight&&highlight.ids.has(ent.from)&&highlight.ids.has(ent.to));
  syncGhosts();
 }
 function clearHighlight(rerender=true){
  if(!highlight&&hud.hidden)return;
  hud.hidden=true;setHighlight(null);
  if(rerender)renderPanel();
 }
 function cancelScan(){
  clearTimeout(scanTimer);scanTimer=null;
  if(!scanning)return;
  scanning=false;viewport.classList.remove('is-scanning');$('#boardFutures').classList.remove('is-scanning');
  if(futures?.winner)finishScan(futures,false);else clearHighlight();
 }
 function currentFutures(){
  const g=graph(),sig=signature(g);
  if(futures&&futuresSig===sig)return futures;
  if(!futures)return null;
  futures=analyzeFutures(g,{locale});futuresSig=sig;
  return futures;
 }
 function scanFutures(){
  clearTimeout(scanTimer);finishInline(true);closeEdgeMenu();
  const g=graph();
  futures=analyzeFutures(g,{locale});futuresSig=signature(g);
  openPanel('futures');
  if(!futures.forks.length||!futures.winner){clearHighlight(false);renderPanel();notice(futures.nextMove.title);return;}
  if(reducedMotion()){finishScan(futures);return;}
  scanning=true;viewport.classList.add('is-scanning');$('#boardFutures').classList.add('is-scanning');
  crowdHudOn=false;hud.hidden=false;hud.classList.remove("is-done");
  fitTo(g.nodes.filter(n=>n.free!==true).map(n=>n.id));
  renderPanel();
  const samples=futures.samples,frames=Math.max(1,Math.min(samples.length,22)),total=BigInt(futures.total);
  let i=0;
  const tick=()=>{
   if(!scanning)return;
   if(i>=frames){finishScan(futures);return;}
   setHighlight(samples[Math.floor(i*samples.length/frames)],false);
   hudText.textContent=t('scanning',{n:fmtBig(total*BigInt(i+1)/BigInt(frames)),total:fmtBig(total)});
   i++;const p=i/frames;
   scanTimer=setTimeout(tick,52+Math.round(160*p*p));
  };
  tick();
 }
 function finishScan(r,moveCamera=true){
  scanning=false;clearTimeout(scanTimer);
  viewport.classList.remove('is-scanning');$('#boardFutures').classList.remove('is-scanning');
  setHighlight(r.winner.nodes,true);
  hud.hidden=false;hud.classList.add('is-done');
  hudText.textContent=t('bestOf',{n:fmtBig(r.total),score:Math.round(r.winner.score),conf:confidenceLabel(r.winner.confidence,locale)});
  if(moveCamera)fitTo(r.winner.nodes);
  renderPanel();
 }
 function showRoute(s){
  setHighlight(s.nodes,true);hud.hidden=false;hud.classList.add('is-done');
  hudText.textContent=(s.blocked?'✕ ':'')+s.choices.map(c=>c.optionTitle).join(' → ')+(s.score!==null?' · '+Math.round(s.score)+'/100':'');
  fitTo(s.nodes);
 }
 function recordDecision(){
  const g=graph();
  const r=currentFutures()||analyzeFutures(g,{locale});
  try{
   const rec=decisionRecord(g,r,{locale});
   const p=freeSlots(g,g.rootId,1)[0];
   const made=addBoardNode(g,{title:rec.title,description:rec.description,kind:'insight',parentId:g.rootId,x:p.x,y:p.y,free:false});
   const root=disp.get(g.rootId);spawnFrom.set(made.id,root?{...root}:p);
   commit(made.graph,{select:made.id});
   ensureVisible(made.id);notice(t('decisionSaved'));
  }catch(err){notice(err.message);}
 }

 // ── Coach actions ──
 function runAction(a){
  if(!a)return;
  switch(a.type){
   case 'edit':
    select(a.nodeId,{keepTab:a.field!=='body'});ensureVisible(a.nodeId);
    if(a.field==='body'){openPanel('note');setTimeout(()=>$('#boardEditBody').focus({preventScroll:true}),80);}else startInline(a.nodeId);
    break;
   case 'suggest':select(a.nodeId,{keepMode:true});thinkMode=a.mode||null;thinkRound=0;openPanel('note');ensureVisible(a.nodeId);render();break;
   case 'add':{const id=addChild(a.parentId,null,{seed:a.seed});if(id){select(id);ensureVisible(id);}break;}
   case 'select':select(a.nodeId);ensureVisible(a.nodeId);break;
   case 'rate':
    select(a.nodeId);$('#boardMore').open=true;openPanel('note');ensureVisible(a.nodeId);
    requestAnimationFrame(()=>{const r=$('#boardRatings');r.classList.remove('is-flash');void r.offsetWidth;r.classList.add('is-flash');r.scrollIntoView({block:'center',behavior:reducedMotion()?'auto':'smooth'});});
    break;
   case 'futures':scanFutures();break;
   case 'decide':recordDecision();break;
  }
 }

 // ── Panel: one purpose at a time ──
 function openPanel(mode){panelMode=mode;renderPanel();}
 function closePanel(){panelMode=null;renderPanel();}
 function renderPanel(){
  if(panelMode==='note'&&!selectedNode())panelMode=null;
  panel.hidden=!panelMode;
  $('#boardPanelTitle').textContent=panelMode?t({note:'panelNote',futures:'panelFutures',brain:'panelBrain',ai:'panelAi'}[panelMode]):'';
  $('#boardNotePanel').hidden=panelMode!=='note';
  $('#boardFuturesPanel').hidden=panelMode!=='futures';
  $('#boardBrainPanel').hidden=panelMode!=='brain';
  $('#boardAiPanel').hidden=panelMode!=='ai';
  $('#boardAi').setAttribute('aria-expanded',String(panelMode==='ai'));
  $('#boardBrain').setAttribute('aria-expanded',String(panelMode==='brain'));
  $('#boardThink').setAttribute('aria-expanded',String(panelMode==='ai'));
  if(panelMode==='ai')renderThinkPanel();
  if(panelMode==='note')renderNoteTab();
  if(panelMode==='futures')renderFuturesTab();
  if(panelMode==='brain')renderBrainPanel();
  scheduleNext();
 }
 function renderNoteTab(){
  const n=selectedNode(),g=graph();
  if(!n)return;
  const root=n.id===g.rootId;
  const kinds=$('#boardKinds');kinds.replaceChildren();
  if(root)kinds.append(el('span','board-root-label',KIND_GLYPH.idea+' '+t('kind_idea')));
  else for(const kind of NOTE_KINDS){
   const b=button('',null,()=>{try{commit(updateBoardMeta(graph(),n.id,{kind}));}catch(err){notice(err.message);}});
   b.append(el('span','',KIND_GLYPH[kind]),el('span','',t('kind_'+kind)));
   b.setAttribute('role','radio');b.setAttribute('aria-checked',String(n.kind===kind));kinds.append(b);
  }
  const title=$('#boardEditTitle'),body=$('#boardEditBody'),ev=$('#boardEvidence');
  if(document.activeElement!==title)title.value=isPlaceholder(n.title)?'':n.title;
  title.placeholder=root?t('rootPlaceholder'):t('notePlaceholder');
  body.placeholder=t('bodyPlaceholder');ev.placeholder=t('evidencePlaceholder');
  if(document.activeElement!==body)body.value=n.description||'';
  const modes=$('#boardModes');modes.replaceChildren();
  const active=thinkMode||defaultModeFor(n.kind);
  for(const mode of THINK_MODES){
   const b=button('',t('mode_'+mode),()=>{thinkMode=mode;thinkRound=0;render();});
   b.setAttribute('role','radio');b.setAttribute('aria-checked',String(active===mode));modes.append(b);
  }
  $('#boardIdeasRow').hidden=isPlaceholder(n.title);
  $('#boardStatusWrap').hidden=root;
  const st=$('#boardStatus');st.replaceChildren();
  for(const s of STATES){
   const b=button('',t('st_'+s),()=>{try{commit(updateBoardMeta(graph(),n.id,{status:s}));}catch(err){notice(err.message);}});
   b.dataset.status=s;b.setAttribute('role','radio');b.setAttribute('aria-checked',String(n.status===s));st.append(b);
  }
  $('#boardRatingsWrap').hidden=n.kind!=='direction';
  const ratings=$('#boardRatings');ratings.replaceChildren();
  for(const key of ['impact','effort']){
   const row=el('div','board-rating'),pips=el('div','board-pips');
   pips.setAttribute('role','radiogroup');pips.setAttribute('aria-label',t(key));
   for(let i=1;i<=5;i++){
    const b=button(i<=(n[key]||0)?'on':'',String(i),()=>{try{commit(updateBoardMeta(graph(),n.id,{[key]:n[key]===i?null:i}));}catch(err){notice(err.message);}});
    b.setAttribute('role','radio');b.setAttribute('aria-checked',String(n[key]===i));b.setAttribute('aria-label',t(key)+' '+i+'/5');pips.append(b);
   }
   row.append(el('span','',t(key)),pips);ratings.append(row);
  }
  $('#boardEvidenceWrap').hidden=root||!(['assumption','experiment','insight'].includes(n.kind)||n.status==='supported'||n.status==='refuted'||n.evidence);
  if(document.activeElement!==ev)ev.value=n.evidence||'';
  if($('#boardMore').open){
   let advice=null;try{advice=nodeAdvice(g,n.id,{locale});}catch{}
   const tools=$('#boardTools');tools.replaceChildren();
   for(const tool of advice?.tools||[]){
    const box=el('div','board-tool'),row=el('div','board-tool-row');
    row.append(el('strong','',tool.name),el('small','',tool.examples.join(' · ')));
    box.append(row,el('span','',tool.how),el('span','',tool.why));
    box.append(button('board-chip-button',t('addStep'),()=>{const id=addChild(n.id,null,{seed:{title:(tool.name+': '+tool.examples.slice(0,2).join(' / ')).slice(0,150),kind:'experiment',description:tool.how+'\n\n'+t('toolsNote')}});if(id)ensureVisible(id);}));
    tools.append(box);
   }
   const skill=$('#boardSkill');skill.replaceChildren();
   if(advice?.skill){
    const box=el('div','board-skill');
    box.append(el('strong','',advice.skill.name),el('span','',advice.skill.summary+' '+advice.skill.why));
    box.append(button('board-chip-button',t('copySkill'),()=>copy(skillBrief(graph(),n.id,advice.skill.id))));
    skill.append(box);
   }
  }
  $('#boardDelete').hidden=root;$('#boardDetach').disabled=root||n.free===true;
  $('#boardLink').setAttribute('aria-pressed',String(!!linkSource));
 }
 // One next step at a time; "›" shows another one.
 let nextTimer=null,nextMove=null;
 function scheduleNext(){clearTimeout(nextTimer);nextTimer=setTimeout(renderNext,90);}
 function renderNext(){
  const g=graph(),box=$('#boardNext');
  let moves=[];try{moves=coachGraph(g,{locale,futures:currentFutures(),limit:12});}catch(err){console.warn(err);}
  nextMove=moves.find(m=>!skipped.has(m.id))||null;
  const n=selectedNode();
  const calm=inline||scanning||highlight||dragging||!hud.hidden;
  const show=!!nextMove&&!calm&&!(isPhone()&&(panelMode||n));
  box.hidden=!show;
  if(show){
   const b=$('#boardNextDo');b.replaceChildren(el('b','',nextMove.icon),el('span','',nextMove.title),el('i','','→'));
   b.title=nextMove.why;b.setAttribute('aria-label',nextMove.title+'. '+nextMove.why);
   $('#boardNextSkip').hidden=moves.filter(m=>!skipped.has(m.id)).length<2;
  }
  if(isPhone()&&n&&!panelMode&&!inline&&!scanning){
   pill.hidden=false;pill.replaceChildren(el('b','',KIND_GLYPH[n.kind]),el('span','',isPlaceholder(n.title)?t('newThought'):n.title),el('b','',t('pillDetails')+' ↑'));
  }else pill.hidden=true;
 }
 function renderBrainPanel(){
  const st=brain.state(),tree=$('#boardBrainTree');
  tree.replaceChildren(...BRAIN_FOLDERS.map(f=>{const li=el('li');li.append(el('code','',f.path),el('small','',f[locale]));return li;}));
  const name=(st.name||'').replace(/[<>&"]/g,'');
  const status=$('#boardBrainStatus');
  status.innerHTML=!st.supported&&!st.handle?t('brainUnsupported')
   :st.mode==='synced'?t('brainSynced',{name,time:st.savedAt.toLocaleTimeString(locale==='pl'?'pl-PL':'en-US',{hour:'2-digit',minute:'2-digit'}),n:st.files})
   :st.mode==='saving'?t('brainSaving',{name})
   :st.mode==='reconnect'?t('brainNeedsAccess',{name})
   :st.mode==='error'?t('brainError',{e:st.error.replace(/[<>&"]/g,'')})
   :t('brainOff');
  if(local&&localState){
   status.innerHTML=localState.mode==='error'?t('localError',{e:localState.error.replace(/[<>&]/g,'')}):t('localSynced',{dir:local.info.dir.replace(/[<>&]/g,''),time:localState.savedAt?' · '+localState.savedAt.toLocaleTimeString(locale==='pl'?'pl-PL':'en-US',{hour:'2-digit',minute:'2-digit'}):''});
  }
  const connect=$('#boardBrainConnect');
  connect.hidden=!st.supported||!!local;
  connect.className=st.handle&&st.mode!=='reconnect'?'futures-secondary':'futures-primary';
  connect.textContent=st.mode==='reconnect'?t('brainReconnect',{name}):st.handle?t('brainDisconnect'):t('brainConnect');
  const steps=$('#boardBrainSteps');
  steps.innerHTML=['brainStep1','brainStep2','brainStep3','brainStep4'].map(k=>'<li>'+t(k)+'</li>').join('');
 }
 // ── Think: brainstorm with Claude on the person's own key ──
 let lastThink=null,thinkBusy=false,ghContext=[],ghLast=0;
 let local=null,localContext=[],localState=null;
 const brainContext=()=>ghContext.length?ghContext:localContext.length?localContext:(brain?.state().context||[]);
 function renderThinkPanel(){
  const goal=$('#boardGoal');
  goal.placeholder=t('goalPlaceholder');
  if(document.activeElement!==goal&&!goal.dataset.dirty)goal.value=readGoal(graph());
  const n=selectedNode(),ctx=brainContext().length?t('scopeCtx'):'';
  $('#boardThinkScope').textContent=n&&n.id!==graph().rootId?t('scopeNote',{t:n.title,ctx}):t('scopeAll',{ctx});
  $('#boardKeyRow').hidden=hasKey();
  const cloud=isCloud(),onCloud=!!local?.info.cloud;
  $('#boardMcpInfo').textContent=cloud?(onCloud?t('cloudLede'):t('cloudCreate')):local?t('mcpLocal',{dir:local.info.dir}):t('mcpStatic');
  $('#boardCopyClaudeConfig').hidden=$('#boardCopyMcpUrl').hidden=!local||onCloud;
  $('#boardCopyAsk').hidden=!local;
  $('#boardCreateConnector').hidden=!cloud||onCloud;
  $('#boardConnector').hidden=!onCloud;
  if(onCloud){
   $('#boardConnectorUrl').value=local.info.connector;
   $('#boardConnectorSteps').innerHTML=['stepClaude','stepChatGPT','stepAsk'].map(k=>'<li>'+t(k)+'</li>').join('');
  }
  $('#boardThinkRun').disabled=thinkBusy;
  const host=$('#boardThinkResult');host.replaceChildren();
  if(!lastThink)return;
  const r=lastThink,box=el('div','think-result');
  if(r.bestPath.choice){
   const best=el('div','think-best');best.append(el('small','',t('bestRoute')),el('strong','',r.bestPath.choice),el('p','',r.bestPath.why));
   if(r.bestPath.steps.length){const ol=el('ol');for(const s of r.bestPath.steps)ol.append(el('li','',s));best.append(ol);}
   if(r.bestPath.risk)best.append(el('small','',t('risk')+': '+r.bestPath.risk));
   if(r.bestPath.planB)best.append(el('p','',t('planB')+': '+r.bestPath.planB));
   box.append(best);
  }
  if(r.questions.length){box.append(el('h4','',t('questionsTitle')));const ul=el('ul');for(const q of r.questions){const li=el('li','',q.question);li.title=q.why;ul.append(li);}box.append(ul);}
  if(r.alternatives.length){box.append(el('h4','',t('altsTitle')));const ul=el('ul');for(const a of r.alternatives)ul.append(el('li','',a.title+(a.impact?' · ↑'+a.impact+' ⚒'+(a.effort||'–'):'')));box.append(ul);}
  host.append(box);
 }
 function thinkStatus(text,error=false){const st=$('#boardThinkStatus');st.textContent=text;st.classList.toggle('error',error);}
 function saveGoal(){
  const goal=$('#boardGoal').value.trim();
  if(goal!==readGoal(graph())){try{commit(withGoal(graph(),goal,{locale}));}catch(err){notice(err.message);}}
  $('#boardGoal').dataset.dirty='';
  return goal;
 }
 function placeThink(result){
  const g=graph(),focus=selected&&selected!==g.rootId?selected:null;
  const out=applyThinkResult(g,result,{focusId:focus,locale});
  const from=disp.get(focus||g.rootId);
  for(const id of out.added){const n=out.graph.nodes.find(x=>x.id===id);spawnFrom.set(id,from?{...from}:{x:n.x,y:n.y});}
  commit(out.graph,{select:focus||null});
  lastThink=out.result;
  thinkStatus(t('thinkDone',{n:out.added.length}));
  renderThinkPanel();
  fitTo([focus||g.rootId,...out.added]);
  if(out.added.length)setTimeout(()=>{if(!scanning)scanFutures();},reducedMotion()?0:900);
  return out;
 }
 async function think(){
  if(thinkBusy)return;
  const key=$('#boardApiKey').value.trim();if(key){setKey(key);$('#boardApiKey').value='';}
  if(!hasKey()){thinkStatus(t('errNoKey'),true);$('#boardApiKey').focus();return;}
  const goal=saveGoal();
  thinkBusy=true;$('#boardThink').classList.add('is-busy');thinkStatus(t('thinking'));renderThinkPanel();
  try{
   const g=graph(),focus=selected&&selected!==g.rootId?selected:null;
   const {result}=await runThink(g,{focusId:focus,goal,context:brainContext(),locale});
   placeThink(result);
   if(panelMode!=='futures')openPanel('ai');
  }catch(err){
   const m=err.message;
   thinkStatus(m==='BAD_KEY'?t('errBadKey'):m==='RATE_LIMIT'?t('errRate'):m==='REFUSAL'?t('errRefusal'):m==='TOO_LONG'?t('errTooLong'):m==='NO_KEY'?t('errNoKey'):t('errNet',{e:m}),true);
   if(m==='BAD_KEY')setKey('');
  }finally{thinkBusy=false;$('#boardThink').classList.remove('is-busy');if(panelMode==='ai')renderThinkPanel();}
 }
 function manualPrompt(){
  const g=graph(),req=thinkRequest(g,{focusId:selected&&selected!==g.rootId?selected:null,goal:$('#boardGoal').value.trim(),context:brainContext(),locale});
  return req.system+'\n\n'+req.messages[0].content+'\n\nReturn ONLY a JSON object (no markdown) that matches this JSON Schema:\n'+JSON.stringify(THINK_SCHEMA);
 }
 async function connectGithub(auto=false){
  const repo=$('#boardGhRepo').value.trim()||localStorage.getItem('thenvio-github-repo')||'';
  if(!repo)return;
  const status=$('#boardGhStatus');
  const tok=$('#boardGhToken').value.trim();if(tok){setToken(tok);$('#boardGhToken').value='';}
  status.textContent=t('ghReading',{repo});
  try{
   const res=await readGithubBrain(repo);
   ghContext=res.context;ghLast=Date.now();
   try{localStorage.setItem('thenvio-github-repo',res.repo);}catch{}
   $('#boardGhRepo').value=res.repo;
   const meta=Object.fromEntries(res.files.map(f=>[f.path,f]));
   mergeFromBrain(res.canvases.map(c=>({graph:c,content:meta[res.paths[c.id]].content,lastModified:meta[res.paths[c.id]].lastModified})));
   status.innerHTML=t('ghRead',{repo:res.repo.replace(/[<>&]/g,''),branch:res.branch.replace(/[<>&]/g,''),n:res.canvases.length,c:res.context.length});
   for(const e of res.errors)notice(e.path+': '+e.message);
  }catch(err){status.textContent=t('ghError',{e:err.message});if(!auto)notice(t('ghError',{e:err.message}));}
 }
 function localStatusUpdate(st){
  localState=st;
  $('#boardBrainDot').className='board-brain-dot '+st.mode;
  $('#boardBrain').title=st.dir;
  if(panelMode==='brain')renderBrainPanel();
 }
 function mergeFromLocal(graphs){
  return mergeFromBrain(graphs.map(g=>({graph:prepareBoard(readIdeaGraph(g)),content:canvasToMarkdown(g),lastModified:Date.parse(g.updatedAt)||0})));
 }
 function askForChat(){
  const g=graph(),goal=$('#boardGoal').value.trim()||readGoal(g);
  return t('askText',{title:g.title,goal:goal?t('askGoal',{goal}):''});
 }
 // ── Swarm: a synthetic crowd drifts toward the options it adopts ──
 let swarm=null,swarmSeed=0,swarmTimer=null,swarmStale=false,swarmWatch=null,crowdHudOn=false;
 const swarmLayer=$('#boardSwarm');
 function setCrowd(optionId,share){
  const e=cards.get(optionId);if(!e)return;
  e.el.classList.add('has-crowd');
  e.crowdPct.textContent=Math.round(share)+'%';
  e.crowdPct.title=t('swarmTitle');
  e.crowdBar.firstChild.style.width=Math.min(100,share)+'%';
 }
 function clearCrowdMeters(){for(const e of cards.values()){e.el.classList.remove('has-crowd');e.crowdPct.textContent='';e.crowdBar.firstChild.style.width='0';}}
 function clearSwarm(){
  clearTimeout(swarmTimer);swarmLayer.replaceChildren();swarmLayer.classList.remove('is-fading');
  viewport.classList.remove('is-swarming');clearCrowdMeters();
 }
 function runSwarm(next=false){
  if(next)swarmSeed++;
  swarm=simulateSwarm(graph(),{locale,seed:swarmSeed});swarmStale=false;swarmWatch=null;
  clearHighlight(false);
  if(selected)deselect();
  openPanel('futures');
  playSwarm(swarm);
 }
 // A rating asked for by the crowd refreshes the crowd quietly, so the result follows the canvas.
 function swarmAfterCommit(){
  if(!swarm)return;
  if(swarmWatch){
   const n=graph().nodes.find(x=>x.id===swarmWatch);
   if(n&&n.impact&&n.effort){
    swarm=simulateSwarm(graph(),{locale,seed:swarmSeed});swarmStale=false;swarmWatch=null;
    clearCrowdMeters();for(const o of swarm.options)if(!o.blocked)setCrowd(o.optionId,o.adoption);
    showCrowdHud(swarm);notice(t('swarmUpdated',{v:swarm.verdict}));
    return;
   }
  }
  swarmStale=true;clearCrowdMeters();
  if(crowdHudOn&&!highlight){hud.hidden=true;crowdHudOn=false;}
 }
 function crowdHudText(sim){
  const w=sim.winner;if(!w)return t('crowdHudNone');
  return t('crowdHud',{c:t('cert_'+sim.certainty),t:w.title.length>34?w.title.slice(0,33)+'…':w.title,r:w.range[0]===w.range[1]?w.adoption+'%':Math.round(w.range[0])+'–'+Math.round(w.range[1])+'%'});
 }
 function showCrowdHud(sim){if(!sim.options.length)return;crowdHudOn=true;hud.hidden=false;hud.classList.add('is-done');hudText.textContent=crowdHudText(sim);}
 // Agents come out of the main idea and flow INTO the card they would take up, disappearing under
 // it; the card's own meter shows the share. Nothing is left over text.
 function playSwarm(sim){
  clearSwarm();
  if(!sim.options.length){renderPanel();return;}
  const g=graph(),root=g.nodes.find(n=>n.id===g.rootId);
  const home={x:root.x+CARD_W/2,y:root.y+CARD_H/2};
  const pr=i=>{const x=Math.sin(i*12.9898+swarmSeed*7.13)*43758.5453;return x-Math.floor(x);};
  const cloud=sim.frames[0].map((_,i)=>({x:home.x+(pr(i)-.5)*CARD_W*.6,y:home.y+(pr(i+999)-.5)*CARD_H*.5}));
  const centre=sim.options.map(o=>{const n=g.nodes.find(x=>x.id===o.optionId);return n?{x:n.x+CARD_W/2,y:n.y+CARD_H/2}:home;});
  viewport.classList.add('is-swarming');
  if(isPhone())panel.classList.add('is-peek');
  hud.hidden=false;hud.classList.remove('is-done');hudText.textContent=t('crowdRunning',{n:sim.agents});
  const dots=cloud.map((p,i)=>{const c=svgEl('circle',{r:'3',cx:'0',cy:'0'});c.style.transform='translate('+p.x+'px,'+p.y+'px)';c.style.transitionDelay=Math.round(pr(i+31)*240)+'ms';swarmLayer.append(c);return c;});
  fitTo([g.rootId,...sim.options.map(o=>o.optionId)]);
  const place=(frame,k)=>{
   frame.forEach((c,i)=>{
    if(c<0)return;
    const p=centre[c];
    dots[i].classList.add('on');
    dots[i].style.transform='translate('+(p.x+(pr(i+5)-.5)*CARD_W*.5)+'px,'+(p.y+(pr(i+9)-.5)*CARD_H*.4)+'px)';
   });
   sim.options.forEach(o=>setCrowd(o.optionId,o.curve[k]));
  };
  const finish=()=>{
   place(sim.frames.at(-1),sim.frames.length-1);
   swarmLayer.classList.add('is-fading');
   swarmTimer=setTimeout(()=>{swarmLayer.replaceChildren();swarmLayer.classList.remove('is-fading');viewport.classList.remove('is-swarming');},700);
   panel.classList.remove('is-peek');
   showCrowdHud(sim);
   renderPanel();
   if(isPhone())fitTo([g.rootId,...sim.options.map(o=>o.optionId)]);
   requestAnimationFrame(()=>$('#boardSwarmSection')?.scrollIntoView({block:'start',behavior:reducedMotion()?'auto':'smooth'}));
  };
  if(reducedMotion()){finish();return;}
  let f=0;
  const step=()=>{if(f>=sim.frames.length){swarmTimer=setTimeout(finish,500);return;}place(sim.frames[f],f);f++;swarmTimer=setTimeout(step,420);};
  swarmTimer=setTimeout(step,300);
 }
 function swarmSection(){
  const sec=el('section','futures-section swarm-section');sec.id='boardSwarmSection';
  sec.append(el('h5','',t('swarmTitle')));
  if(!swarm){
   sec.append(el('p','board-fineprint',t('swarmIntro')),button('futures-secondary',t('swarmRun'),()=>runSwarm()));
   return sec;
  }
  if(swarm.empty){sec.append(el('p','board-empty',swarm.empty));return sec;}
  if(swarmStale){
   const st=el('div','swarm-stale');st.append(el('span','',t('swarmStale')),button('futures-secondary',t('swarmRefresh'),()=>runSwarm()));sec.append(st);
  }
  const head=el('div','swarm-verdict');
  head.append(el('span','swarm-cert '+swarm.certainty,t('cert_'+swarm.certainty)),el('p','',swarm.verdict));
  sec.append(head);
  if(swarm.next){
   const nx=swarm.next;
   const b=button('futures-next',null,()=>{
    if(nx.code==='rate'){swarmWatch=nx.optionId;runAction({type:'rate',nodeId:nx.optionId});}
    else runAction({type:'add',parentId:nx.optionId,seed:{title:nx.title.slice(0,150),kind:'experiment',description:nx.why+'\n\n'+t('swarmTestHow')}});
   });
   b.append(el('small','',t('nextMove')),el('strong','',nx.title),el('span','',nx.why));
   sec.append(b);
  }
  for(const o of swarm.options){
   const row=el('div','swarm-option'),top=el('div','swarm-row');
   const label=o.blocked?'✕':o.adoption+'%';
   const rangeTxt=o.blocked||o.range[0]===o.range[1]?'':' '+Math.round(o.range[0])+'–'+Math.round(o.range[1]);
   const nums=el('span','swarm-num');nums.append(el('b','',label),el('small','',rangeTxt));
   const name=button('swarm-name',o.title,()=>{select(o.optionId,{keepTab:true});centerOn(o.optionId);});
   top.append(name,nums);
   const bar=el('div','swarm-bar'),rng=el('em'),fill=el('i');
   if(!o.blocked){rng.style.left=o.range[0]+'%';rng.style.width=Math.max(1,o.range[1]-o.range[0])+'%';fill.style.width=o.adoption+'%';}
   bar.append(rng,fill);
   row.append(top,bar);
   const bits=[];
   if(o.objections[0])bits.push(t('swarmObj',{o:o.objections[0].name,p:o.objections[0].share})+' · '+o.objections[0].segments.slice(0,2).map(x=>x.name).join(', '));
   if(o.tippingRound)bits.push(t('swarmFriends',{p:o.fromFriends,n:o.tippingRound}));
   if(!o.rated&&!o.blocked)bits.push(t('swarmUnrated'));
   if(bits.length)row.append(el('span','swarm-why',bits.join(' · ')));
   sec.append(row);
  }
  const w=swarm.winner,fw=currentFutures()?.winner;
  if(w&&fw&&swarm.certainty!=='unclear'&&!fw.options.includes(w.optionId)){
   const best=fw.choices.map(c=>c.optionTitle).join(' → ');
   sec.append(el('p','futures-weak',t('swarmConflict',{f:best,c:w.title})));
  }
  const actions=el('div','futures-actions');
  actions.append(button('futures-secondary',t('swarmAdd'),()=>{
   const out=swarmNotes(graph(),swarm,{locale});
   for(const id of out.added){const n=out.graph.nodes.find(x=>x.id===id);spawnFrom.set(id,{x:n.x,y:n.y});}
   commit(out.graph);notice(t('swarmAdded',{n:out.added.length}));
  }),button('futures-secondary',t('swarmAgain'),()=>runSwarm(true)));
  sec.append(actions,el('p','board-fineprint',t('swarmNote')),el('p','futures-disclaimer',swarm.disclaimer));
  return sec;
 }
 function brainStatus(st){
  const dot=$('#boardBrainDot');
  dot.className='board-brain-dot'+(st.handle?' '+st.mode:'');
  $('#boardBrain').title=st.handle?st.name+' · '+st.mode:t('panelBrain');
  if(panelMode==='brain')renderBrainPanel();
 }
 // Canvases read from the brain: new ones join; changed files that are newer than the local copy win.
 function mergeFromBrain(items){
  let added=0,updated=0;
  const starter=graph();
  const starterEmpty=isPlaceholder(starter.title)&&starter.nodes.length===1;
  for(const {graph:g,content,lastModified} of items){
   const local=portfolio.graphs.find(x=>x.id===g.id);
   if(!local){if(portfolio.graphs.length>=MAX)continue;portfolio.graphs.push(g);added++;continue;}
   if(canvasToMarkdown(local)===content)continue;
   if(lastModified>Date.parse(local.updatedAt)){
    if(local.id===portfolio.activeId){history.push(local);future=[];}
    portfolio.graphs=portfolio.graphs.map(x=>x.id===g.id?g:x);updated++;
   }
  }
  if(!added&&!updated)return {added,updated};
  if(starterEmpty&&added&&portfolio.graphs.length>1){
   if(inline)finishInline(false);
   const next=items.find(x=>portfolio.graphs.some(g=>g.id===x.graph.id))?.graph.id;
   portfolio.activeId=next;portfolio.graphs=portfolio.graphs.filter(x=>x.id!==starter.id);switchGraph(next);
  }
  else{persist();render();}
  notice(t('brainImported',{n:added+updated}));
  return {added,updated};
 }
 function reasonText(b){
  if(b.code==='conflict')return t('reason_conflict',{a:b.title,b:b.otherTitle});
  if(b.code==='refuted-option')return t('reason_option',{t:b.title});
  return t('reason_refuted',{t:b.title});
 }
 function renderFuturesTab(){
  const host=$('#boardFuturesBody');host.replaceChildren();
  const g=graph(),r=currentFutures();
  const scanBtn=(label,cls='futures-primary')=>button(cls,label,scanFutures);
  if(!r){
   host.append(el('p','board-lede',t('tabFutures')),el('p','board-empty',t('futuresIntro')));
   let forks=0,total='1';try{forks=findForks(g).length;total=countFutures(g).toString();}catch{}
   if(forks){const hero=el('div','futures-hero');hero.append(el('div','futures-count',fmtBig(total)),el('div','futures-sub',t('stats',{n:g.nodes.length,f:forks,s:fmtBig(total)})));host.append(hero);}
   else host.append(el('p','board-empty',t('noForksBody')));
   host.append(scanBtn(t('scanNow')));
   host.append(swarmSection());
   return;
  }
  const hero=el('div','futures-hero');
  hero.append(el('div','futures-count',fmtBig(r.total)),el('div','futures-sub',r.exhaustive?t('exhaustive'):t('guided',{k:fmtBig(r.evaluated)})));
  host.append(hero);
  if(!r.forks.length){
   host.append(el('p','board-lede',t('noForksTitle')),el('p','board-empty',t('noForksBody')));
   const next=button('futures-next',null,()=>runAction({type:'suggest',nodeId:r.nextMove.nodeId,mode:'explore'}));
   next.append(el('small','',t('nextMove')),el('strong','',r.nextMove.title),el('span','',r.nextMove.why));host.append(next);
   host.append(el('p','futures-disclaimer',r.disclaimer),swarmSection());return;
  }
  const sum=r.viable+r.blocked||1;
  const split=el('div','futures-split');const ok=el('i','ok'),no=el('i','no');ok.style.width=(r.viable/sum*100)+'%';no.style.width=(r.blocked/sum*100)+'%';split.append(ok,no);
  const legend=el('div','futures-legend');legend.append(el('span','',r.viable+' '+t('viable')),el('span','',r.blocked+' '+t('blocked')));
  host.append(split,legend);
  if(!r.winner){
   const card=el('div','futures-card');card.append(el('h4','',t('allBlocked')),el('p','board-empty',r.nextMove.why));host.append(card);
  }else{
   const w=r.winner,card=el('div','futures-card win');
   const h=el('h4');h.append(el('span','',t('winning')),el('span','',confidenceLabel(w.confidence,locale)));
   const score=el('div','futures-score',String(Math.round(w.score)));score.append(el('small','','/100 '+t('score')));
   const route=el('ol','futures-route');
   for(const c of w.choices){
    const li=el('li'),b=button('',null,()=>{select(c.optionId,{keepTab:true});centerOn(c.optionId);});
    b.append(el('small','',c.forkTitle),el('strong','',c.optionTitle));li.append(b);route.append(li);
   }
   card.append(h,score,route);
   if(r.why.length){const why=el('ul','futures-why');for(const line of r.why)why.append(el('li','',line));card.append(el('h4','',t('why')),why);}
   if(r.weakest){
    const weak=el('div','futures-weak');
    weak.append(el('strong','',t('weakest')+': '+r.weakest.title),el('span','',r.weakest.everything?t('everything'):t('ifFalse',{d:r.weakest.drop})+(r.weakest.fallback?' · '+t('planB')+': '+r.weakest.fallback.choices.map(c=>c.optionTitle).join(' → '):'')));
    weak.addEventListener('click',()=>{select(r.weakest.nodeId,{keepTab:true});centerOn(r.weakest.nodeId);});weak.style.cursor='pointer';
    card.append(weak);
   }
   const actions=el('div','futures-actions');
   actions.append(button('futures-primary',t('record'),recordDecision),button('futures-secondary',t('showRoute'),()=>showRoute(w)),scanBtn(t('rescan'),'futures-secondary'));
   card.append(actions);host.append(card);
  }
  if(r.nextMove&&r.nextMove.code!=='commit'){
   const sec=el('div','futures-section');
   const next=button('futures-next',null,()=>runAction(coachActionFor(r.nextMove)));
   next.append(el('small','',t('nextMove')),el('strong','',r.nextMove.title),el('span','',r.nextMove.why));
   sec.append(next);host.append(sec);
  }
  const others=r.scenarios.filter(s=>s.key!==r.winner?.key&&!s.blocked).slice(0,4);
  if(others.length){
   const sec=el('details','futures-section');sec.append(el('summary','',t('others')+' ('+others.length+')'));
   const list=el('div','futures-list');
   for(const s of others){
    const b=button('futures-alt',null,()=>showRoute(s));
    const diff=r.winner?s.choices.filter(c=>!r.winner.choices.some(x=>x.optionId===c.optionId)):s.choices;
    b.append(el('strong','',s.choices.map(c=>c.optionTitle).join(' → ')),el('b','',String(Math.round(s.score))),el('span','',diff.map(c=>c.forkTitle+': '+c.optionTitle).join(' · ')));
    list.append(b);
   }
   sec.append(list);host.append(sec);
  }
  if(r.blockedSamples.length){
   const sec=el('details','futures-section');sec.append(el('summary','',t('blockedRoutes')+' ('+r.blocked+')'));
   const list=el('div','futures-list');
   for(const s of r.blockedSamples){
    const b=button('futures-alt blocked',null,()=>showRoute(s));
    b.append(el('strong','',s.choices.map(c=>c.optionTitle).join(' → ')||g.title),el('b','','✕'),el('span','',s.blockers.slice(0,2).map(reasonText).join(' · ')));
    list.append(b);
   }
   sec.append(list);host.append(sec);
  }
  host.append(el('p','futures-disclaimer',r.disclaimer));
  host.append(swarmSection());
 }
 function coachActionFor(m){
  const g=graph();
  if(m.code==='rate')return {type:'rate',nodeId:m.nodeId};
  if(m.code==='test'){const n=g.nodes.find(x=>x.id===m.nodeId);return {type:'add',parentId:m.nodeId,seed:{title:(locale==='pl'?'Jak sprawdzić: ':'How to test: ')+(n?.title||'').slice(0,100),kind:'experiment',description:''}};}
  if(m.code==='differentiate')return {type:'select',nodeId:m.nodeId};
  if(m.code==='commit')return {type:'decide'};
  return {type:'suggest',nodeId:m.nodeId,mode:'explore'};
 }

 // ── Render ──
 function populateProjects(){
  const sel=$('#boardSelect');sel.replaceChildren();
  for(const g of portfolio.graphs){const o=el('option','',isPlaceholder(g.title)?t('newThought'):g.title);o.value=g.id;sel.append(o);}
  sel.value=portfolio.activeId;
  $('#boardUndo').disabled=!history.length;$('#boardRedo').disabled=!future.length;
 }
 function render(){
  populateProjects();syncNodes();syncEdges();syncGhosts();renderPanel();
  viewport.classList.toggle('is-linking',!!linkSource);
  firstPaint=false;
 }
 function initialCamera(){
  if(!viewport.clientWidth)return;
  needsCamera=false;
  const g=graph();
  if(g.nodes.length>1)fitTo(null,{animate:false});else centerOn(g.rootId,{animate:false,scale:1});
  if(isPlaceholder(g.nodes.find(n=>n.id===g.rootId).title)&&g.nodes.length===1)requestAnimationFrame(()=>startInline(g.rootId));
 }
 function resetSurface(){
  for(const entry of cards.values())entry.el.remove();
  for(const ent of edges.values())ent.group.remove();
  for(const ent of ghostEls.values())ent.el.remove();
  cards.clear();edges.clear();ghostEls.clear();disp.clear();override.clear();ghostList=[];ghostEdgeLayer.replaceChildren();
  firstPaint=true;
 }
 function switchGraph(id){
  if(!portfolio.graphs.some(g=>g.id===id))return;
  finishInline(true);cancelScan();clearHighlight(false);
  portfolio.activeId=id;selected=null;linkSource=null;history=[];future=[];futures=null;futuresSig='';thinkMode=null;thinkRound=0;
  if(panelMode==='note')panelMode=null;
  persist();resetSurface();refreshLocale();render();needsCamera=true;requestAnimationFrame(initialCamera);
 }
 function saveExport(){
  const blob=new Blob([JSON.stringify(portfolio,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=el('a');
  a.href=url;a.download='thenvio-canvas-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  notice(t('canvasExported'));
 }
 async function importFile(file){
  if(!file)return;
  if(file.size>5_000_000){notice(t('tooLarge'));return;}
  try{
   if(/\.(md|markdown)$/i.test(file.name)){
    const g=markdownToCanvas(await file.text(),{now:new Date().toISOString()});
    const r=mergeFromBrain([{graph:g,content:'',lastModified:Date.now()}]);
    if(!r.added&&!r.updated)notice(t('canvasImported'));
    switchGraph(g.id);return;
   }
   const body=JSON.parse(await file.text());
   const incoming=(body?.format==='thenvio-ideas-collection-v1'?body.graphs:[body]);
   if(!Array.isArray(incoming)||!incoming.length||incoming.length>MAX)throw Error('Invalid file.');
   const imported=incoming.map(readIdeaGraph).map(prepareBoard);
   if(portfolio.graphs.length+imported.length>MAX)throw Error(t('maxCanvases'));
   for(const g of imported){
    const clash=portfolio.graphs.some(x=>x.id===g.id);
    portfolio.graphs.push({...g,id:clash?'g_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6):g.id});
   }
   switchGraph(portfolio.graphs.at(-1).id);notice(t('canvasImported'));
  }catch(e){notice(t('importFailed',{e:e.message}));}
 }
 function newCanvas(){$('#boardCreateTitle').value='';$('#boardCreateDialog').showModal();$('#boardCreateTitle').focus();}
 async function copy(text){
  try{await navigator.clipboard.writeText(text);notice(t('copied'));}
  catch{
   const area=el('textarea');area.value=text;area.style.cssText='position:fixed;left:-9999px';document.body.append(area);area.select();
   const ok=document.execCommand('copy');area.remove();notice(ok?t('copied'):t('clipboardBlocked'));
  }
 }
 // Debounced panel text edits; one undo step per editing burst.
 let textTimer=null;
 function flushText(){
  clearTimeout(textTimer);textTimer=null;
  const n=selectedNode();if(!n)return;
  const raw=$('#boardEditTitle').value.trim().replace(/\s+/g,' ');
  const title=raw||n.title,description=$('#boardEditBody').value;
  if(title===n.title&&description===(n.description||''))return;
  try{
   let next=updateBoardText(graph(),n.id,{title,description});
   if(n.id!==graph().rootId&&isPlaceholder(n.title)&&title!==n.title){const kind=inferKind(title);if(kind!==n.kind)next=updateBoardMeta(next,n.id,{kind});}
   commit(next,{coalesce:'text:'+n.id});
   if(n.id===graph().rootId)refreshLocale();
  }catch(err){notice(err.message);}
 }
 const queueText=()=>{clearTimeout(textTimer);textTimer=setTimeout(flushText,380);};

 // ── Controls ──
 const menu=$('#boardMenuDetails');
 for(const b of menu.querySelectorAll('button'))b.addEventListener('click',()=>{menu.open=false;});
 document.addEventListener('pointerdown',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
 $('#boardSelect').addEventListener('change',e=>switchGraph(e.target.value));
 $('#boardNew').addEventListener('click',newCanvas);
 $('#boardCreateForm').addEventListener('submit',e=>{
  e.preventDefault();
  const title=$('#boardCreateTitle').value.trim();
  if(!title)return;
  if(portfolio.graphs.length>=MAX){notice(t('maxCanvases'));return;}
  const g=prepareBoard(makeIdea(title.slice(0,150)));
  portfolio.graphs.push(g);$('#boardCreateDialog').close();
  switchGraph(g.id);selected=g.rootId;render();
 });
 $('#boardAdd').addEventListener('click',()=>{const r=viewport.getBoundingClientRect();addFree(worldFromClient(r.left+r.width/2,r.top+r.height*.42));});
 $('#boardChild').addEventListener('click',()=>{if(selected)addChild(selected);});
 $('#boardDetach').addEventListener('click',()=>{if(!selected)return;try{commit(detachNote(graph(),selected));}catch(err){notice(err.message);}});
 $('#boardLink').addEventListener('click',()=>{
  finishInline(true);
  linkSource=linkSource?null:(selected||'__await__');
  notice(linkSource?(linkSource==='__await__'?t('chooseFirst'):t('chooseSecond')):t('linkCancelled'));
  render();
 });
 $('#boardArrange').addEventListener('click',()=>{
  finishInline(true);
  try{commit(tidyLayout(graph()));notice(t('arranged'));setTimeout(()=>fitTo(),reducedMotion()?0:380);}catch(err){notice(err.message);}
 });
 $('#boardPanelClose').addEventListener('click',()=>{if(panelMode==='note'&&!isPhone())deselect();closePanel();});
 pill.addEventListener('click',()=>openPanel('note'));
 $('#boardNextDo').addEventListener('click',()=>{if(nextMove)runAction(nextMove.action);});
 $('#boardNextSkip').addEventListener('click',()=>{if(nextMove)skipped.add(nextMove.id);renderNext();});
 $('#boardMore').addEventListener('toggle',()=>{if($('#boardMore').open)renderNoteTab();});
 $('#boardEditForm').addEventListener('submit',e=>{e.preventDefault();flushText();});
 $('#boardEditTitle').addEventListener('input',queueText);
 $('#boardEditTitle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();flushText();e.target.blur();}});
 $('#boardEditBody').addEventListener('input',queueText);
 for(const id of ['#boardEditTitle','#boardEditBody'])$(id).addEventListener('blur',()=>{if(textTimer)flushText();});
 let evTimer=null;
 $('#boardEvidence').addEventListener('input',e=>{
  clearTimeout(evTimer);const id=selected,value=e.target.value;
  evTimer=setTimeout(()=>{try{if(nodeById(id))commit(updateBoardMeta(graph(),id,{evidence:value}),{coalesce:'ev:'+id});}catch(err){notice(err.message);}},400);
 });
 $('#boardSuggestMore').addEventListener('click',()=>{thinkRound++;render();});
 $('#boardDelete').addEventListener('click',()=>{if(selected)removeNode(selected);});
 $('#boardCopyContext').addEventListener('click',()=>{if(selected)copy(ideaContext(graph(),selected));});
 $('#boardUndo').addEventListener('click',()=>restore(true));
 $('#boardRedo').addEventListener('click',()=>restore(false));
 $('#boardZoomIn').addEventListener('click',()=>zoomAt(1.2,undefined,undefined,true));
 $('#boardZoomOut').addEventListener('click',()=>zoomAt(1/1.2,undefined,undefined,true));
 $('#boardFit').addEventListener('click',()=>fitTo());
 $('#boardFutures').addEventListener('click',()=>scanning?cancelScan():scanFutures());
 $('#boardMenuImport').addEventListener('click',()=>$('#importInput').click());
 $('#boardMenuExport').addEventListener('click',saveExport);
 $('#boardMenuSettings').addEventListener('click',()=>$('#settingsButton').click());
 $('#boardAi').addEventListener('click',()=>panelMode==='ai'?closePanel():openPanel('ai'));
 $('#boardAiClose').addEventListener('click',closePanel);
 $('#boardBrain').addEventListener('click',()=>panelMode==='brain'?closePanel():openPanel('brain'));
 $('#boardBrainConnect').addEventListener('click',async()=>{
  const st=brain.state();
  try{
   if(st.mode==='reconnect')await brain.reconnect();
   else if(st.handle)await brain.disconnect();
   else{const r=await brain.connect();if(!r.canvases.length)notice(t('brainSynced',{name:brain.state().name,time:'',n:brain.state().files}).replace(/<[^>]+>/g,''));}
  }catch(err){if(err?.name!=='AbortError')notice(t('brainError',{e:err.message}));}
  renderBrainPanel();
 });
 $('#boardBrainDownload').addEventListener('click',()=>{try{brain.download();}catch(err){notice(err.message);}});
 $('#boardBrainOpen').addEventListener('click',()=>$('#boardBrainFolder').click());
 $('#boardBrainFolder').addEventListener('change',async e=>{
  try{const r=await brain.importFiles([...e.target.files]);if(!r.canvases.length)notice(t('brainNothing'));for(const x of r.errors)notice(x.path+': '+x.message);}
  catch(err){notice(t('importFailed',{e:err.message}));}
  e.target.value='';
 });
 $('#boardThink').addEventListener('click',()=>panelMode==='ai'?closePanel():openPanel('ai'));
 $('#boardThinkRun').addEventListener('click',think);
 $('#boardGoal').addEventListener('input',e=>{e.target.dataset.dirty='1';});
 $('#boardGoal').addEventListener('change',saveGoal);
 $('#boardApiKey').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();think();}});
 $('#boardCopyPrompt').addEventListener('click',()=>copy(manualPrompt()));
 $('#boardImportAi').addEventListener('click',()=>{
  try{
   let text=$('#boardAiJson').value.trim();
   text=text.replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
   if(!text){notice(t('nothingToImport'));return;}
   placeThink(text);$('#boardAiJson').value='';
  }catch(err){notice(t('invalidAi',{e:err.message}));}
 });
 $('#boardGhConnect').addEventListener('click',()=>connectGithub(false));
 $('#boardCopyAsk').addEventListener('click',()=>{saveGoal();copy(askForChat());});
 $('#boardCopyClaudeConfig').addEventListener('click',async()=>{
  if(!local)return;
  const cfg={mcpServers:{thenvio:local.info.mcp.stdio}};
  try{await navigator.clipboard.writeText(JSON.stringify(cfg,null,2));notice(t('configCopied'));}catch{copy(JSON.stringify(cfg,null,2));}
 });
 $('#boardCopyMcpUrl').addEventListener('click',()=>{
  if(!local)return;
  const steps=(locale==='pl'?['ChatGPT potrzebuje publicznego adresu HTTPS do Twojego lokalnego Thenvio:',
    '1. Zatrzymaj Thenvio i uruchom z tokenem:  THENVIO_MCP_TOKEN=<długi-losowy-ciąg> npm start',
    '2. Wystaw port przez tunel, np.:  npx cloudflared tunnel --url http://localhost:'+new URL(local.info.mcp.http).port,
    '3. W ChatGPT: Plugins → + → Add custom MCP server, adres:  https://<adres-tunelu>/mcp?key=<token>',
    '4. W czacie wybierz Thenvio i wklej polecenie z przycisku „Kopiuj polecenie do czatu”.']
   :['ChatGPT needs a public HTTPS address for your local Thenvio:',
    '1. Restart Thenvio with a token:  THENVIO_MCP_TOKEN=<long-random-string> npm start',
    '2. Expose the port through a tunnel, e.g.:  npx cloudflared tunnel --url http://localhost:'+new URL(local.info.mcp.http).port,
    '3. In ChatGPT: Plugins → + → Add custom MCP server, URL:  https://<tunnel-address>/mcp?key=<token>',
    '4. Pick Thenvio in a chat and paste the request from “Copy the request for the chat”.']).join('\n');
  copy(steps);notice(t('chatgptCopied'));
 });
 document.addEventListener('keydown',e=>{
  if(!view.classList.contains('active'))return;
  const target=e.target instanceof Element?e.target:document.body;
  if(target.closest('dialog'))return;
  const typing=!!target.closest('input,textarea,select,[contenteditable="true"]');
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&!typing&&e.key.toLowerCase()==='z'){e.preventDefault();restore(!e.shiftKey);return;}
  if(mod&&!typing&&e.key.toLowerCase()==='y'){e.preventDefault();restore(false);return;}
  if(typing||mod||e.altKey)return;
  const inCanvas=target===document.body||!!target.closest('#boardViewport');
  if(!inCanvas)return;
  if(e.key==='Escape'){
   if(!edgeMenu.hidden){closeEdgeMenu();return;}
   if(scanning){cancelScan();return;}
   if(highlight){clearHighlight();return;}
   if(linkSource){linkSource=null;notice(t('linkCancelled'));render();return;}
   if(selected){deselect();viewport.focus({preventScroll:true});}
   return;
  }
  if(target.closest('button,a,summary'))return;
  const n=selectedNode();if(!n)return;
  switch(e.key){
   case 'Enter':e.preventDefault();if(e.shiftKey)addSibling(n.id);else startInline(n.id);break;
   case 'F2':e.preventDefault();startInline(n.id);break;
   case 'Tab':
    if(e.shiftKey){if(n.parentId&&n.free!==true){e.preventDefault();select(n.parentId,{focus:true,keepTab:true});}}
    else{e.preventDefault();addChild(n.id);}
    break;
   case 'Delete':case 'Backspace':if(n.id!==graph().rootId){e.preventDefault();removeNode(n.id);viewport.focus({preventScroll:true});}break;
   case 'ArrowUp':case 'ArrowDown':case 'ArrowLeft':case 'ArrowRight':e.preventDefault();navigateSpatial(e.key);break;
  }
 });
 // The camera is a transform. Browsers still scroll overflow:hidden boxes to reveal a focused
 // element, which would shift the dock and notes; undo that and move the camera instead.
 for(const box of [viewport,$('.board-body'),$('.board-shell')])box.addEventListener('scroll',()=>{if(box.scrollTop||box.scrollLeft){box.scrollTop=0;box.scrollLeft=0;}});
 viewport.addEventListener('focusin',e=>{const card=e.target.closest?.('.board-note');if(card&&!dragging)ensureVisible(card.dataset.id);});
 const resizeObserver=new ResizeObserver(()=>{if(needsCamera)initialCamera();else applyCamera();renderPanel();});
 resizeObserver.observe(viewport);
 window.matchMedia('(max-width: 690px)').addEventListener('change',()=>{if(panelMode==='note')panelMode=null;renderPanel();});
 brain=createBrainSync({
  getGraphs:()=>portfolio.graphs.filter(g=>!(isPlaceholder(g.title)&&g.nodes.length===1)),
  merge:mergeFromBrain,status:brainStatus,locale:()=>locale
 });
 refreshLocale();
 render();
 requestAnimationFrame(initialCamera);
 brain.restore().catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;brain.refresh();if(ghLast&&Date.now()-ghLast>60000)connectGithub(true);});
 async function startSync(info){
  local=createLocalBrain(info,{merge:mergeFromLocal,status:localStatusUpdate});
  try{await local.start();}catch(err){notice(t('localError',{e:err.message}));}
  localContext=await local.context();
  for(const g of portfolio.graphs)if(!(isPlaceholder(g.title)&&g.nodes.length===1)&&!info.canvases.some(c=>c.id===g.id))local.schedule(g);
  const want=new URLSearchParams(location.search).get('canvas');
  if(want&&portfolio.graphs.some(g=>g.id===want)&&want!==portfolio.activeId)switchGraph(want);
  if(panelMode==='ai')renderThinkPanel();
 }
 detectLocalBrain().then(info=>{
  if(info)return startSync(info);
  if(isCloud()){const id=cloudBrainId();if(id)return startSync(cloudInfo(id));}
 });
 $('#boardCreateConnector').addEventListener('click',async()=>{
  if(local)return;
  await startSync(cloudInfo(createCloudBrainId()));
  renderThinkPanel();
 });
 $('#boardCopyConnector').addEventListener('click',async()=>{
  const v=$('#boardConnectorUrl').value;
  try{await navigator.clipboard.writeText(v);notice(t('connectorCopied'));}catch{$('#boardConnectorUrl').select();copy(v);}
 });
 try{const repo=localStorage.getItem('thenvio-github-repo');if(repo){$('#boardGhRepo').value=repo;connectGithub(true);}}catch{}
 return {
  show(){if(needsCamera)requestAnimationFrame(initialCamera);else applyCamera();renderPanel();},
  create:newCanvas,
  import(){$('#importInput').click();},
  importFile,
  export:saveExport,
  getGraph:()=>structuredClone(graph()),
  scanFutures,
  brain:()=>brain
 };
}
