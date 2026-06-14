# Inlämning 3 - Granskningsfasen

Presentation på figma: 
https://www.figma.com/board/UitaJT4H8hl28KNGnIGbRr/Projekt-%22s%C3%A4ker-systemutveckling%22?node-id=0-1&t=TnLGOxraNQkjn304-1

Vi genomförde säkerhetsscanning med CodeQL och Dependabot via GitHub. De två verktygen identifierade kritiska sårbarheter inom två huvudområden: applikationslogik (brute force och överbelastning) samt externa beroenden (sårbarheter i tredjepartsbibliotek). 

Vi kommer här redovisa för vad dessa sårbarheter skulle innebära, såväl som potentiella konsekvenser och resonemanget bakom våra implementerade åtgärder.

CodeQL: Problemformulering och risker
När vi körde CodeQL hittade vi problemet att vår app inte hade några begränsningar för hur många gånger någon kunde skicka anrop till servern. Det kallas rate limiting och utan det var vi sårbara för två typer av attacker: 
- Brute force-attacker
- Denial of Service (DoS)
Hur vi resonerade kring åtgärder:
För att skydda oss mot dessa hot valde vi att bygga upp ett skydd i flera lager via vår middleware-fil (ratelimiter.js) Tanken är att om ett lager kringgås finns det alltid ett till.

Vi åtgärdade med ett Globalt skydd (globalLimiter): Vi satte ett tak för hur många anrop en och samma IP-adress får göra, oavsett vilken del av appen de försöker nå. Det skyddar hela systemet mot DoS-attacker. 
Bristen vi åtgärdade återfinns i två av OWASP:s mest välkända säkerhetskategorier: 
OWASP: A04:2021-Insecure Design, eftersom avsaknad av rate limiting är ett designbeslut som öppnar upp för attacker 
OWASP: A05:2021-Security Misconfiguration, eftersom en server utan trafikbegränsningar är en vanlig och allvarlig säkerhetsbrist 

Sen har vi riktat skydd (loginLimiter): Inloggning och registrering är extra känsligt, där behövs ett striktare skydd. Vi la därför till loginLimiter specifikt på dessa ställen. Efter ett visst antal misslyckade försök blockeras IP-adressen automatiskt, vilket gör att brute force-attacker i princip omöjliga eller i alla fall avsevärt försvårade.
Kopplingen till OWASP:
A04:2021 – Insecure Design, eftersom avsaknad av riktad begränsning på känsliga endpoints möjliggör brute force-attacker
A05:2021 – Security Misconfiguration, eftersom autentiseringsendpoints alltid bör ha striktare säkerhetsinställningar.

Sen till fel ordning i koden (user.save()): Vi hittade också ett problem i hur registreringen fungerade – koden skapade en inloggningstoken innan vi var säkra på att användaren faktiskt sparas i databasen. Det betyder att någon i teorin kunde ha en giltig token för ett konto som inte existerar. Vi fixade detta genom att lägga till await user save() så att databasen alltid sparar användaren först.
Kopplingen till OWASP:
A07:2021 – Identification and Authentication Failures, eftersom fel ordning i autentiseringsflödet kan leda till ogiltiga sessioner och komprometterad identitetshantering.

Dependabot-fynd: Problemformulering och risker
Via vår scan med Dependabot identifierade vi 16 sårbarheter i projektets dependencies. Det visar på ett tydligt sätt vilka risker som finns med externa bibliotek, där sårbarheter “ärvs” in i egna system. Nedan följer de instanser där sårbarheter hittades:
- tar (via bcrypt): Sårbarheter i arkivhanteringsbibliotek som tar handlar ofta om filöverskrivning (Directory Traversal) eller Denial of Service vid parsning av skadliga filer. Eftersom bcrypt använder detta sub-bibliotek kan applikationen drabbas indirekt vid hantering av krypteringsresurser.
- jsonwebtoken: Äldre versioner av detta bibliotek har kända brister gällande verifiering av signaturer (till exempel att acceptera algoritmen "none"), vilket tillåter angripare att förfalska tokens och kringgå autentiseringen helt.
- Vite, esbuild och qs: Sårbarheter i byggverktyg (Vite, esbuild) kan leda till kodexekvering på utvecklares maskiner eller i CI/CD-pipelines. Brist i qs kan leda till prototyp-förorening (Prototype Pollution), vilket kan krascha applikationen eller manipulera objektstrukturer i JavaScript.

Resonemang kring åtgärder
OBS! Vi har valt att inte själva implementera dessa patchningar, då vi inte besitter tillräcklig kunskap för att hantera potentiella konflikter eller krascher som kan uppstå vid en sådan åtgärd. Därför ombeds IT-avdelningen att äga ansvaret över samtlig patchning. 

Vi rekommenderar att uppdatera samtliga dependencies till patchade versioner som den mest effektiva strategin. Att ligga kvar på utdaterade versioner innebär att vi accepterar kända sårbarheter (CVE-id) som ligger öppet tillgängliga i publika databaser, vilket gör dem enkla att utnyttja för exempelvis automatiserade attackverktyg.

Uppdateringen av tar till 7.5.11 och jsonwebtoken till 9.0.0 skulle stänga kända säkerhetshål direkt vid källan.
Genom att uppdatera utvecklingsverktyg (Vite, esbuild) skulle vi även säkra leveranskedjan (Supply Chain Security), vilket kan förhindra att skadlig kod injiceras under kompileringsfasen.
OWASP: A06:2021-Vulnerable and Outdated Components

Sammanfattning av verksamhetskonsekvenser
Att ignorera de sårbarheter som identifierades hade kunnat leda till obehörig datatillgång, stulna användarkonton och kraschande system. Genom att kombinera ovan kodändringar (CodeQL-åtgärder) med rekommenderad regelbunden patchhantering (Dependabot-åtgärder) skulle vi uppnå en högre säkerhetsnivå (Defense in Depth). Systemet skulle därmed vara både mer motståndskraftigt mot riktade externa attacker och bättre skyddat mot sårbarheter i den egna leveranskedjan.

Utifrån våra förutsättningar har vi i fas 1 satt upp säkerhetskrav. Vi har åtgärdat en del av dessa i koden och hänvisat till rekommenderade åtgärder som vi ansett varit för komplexa för oss. Vi har även använt oss av verktyg för att identifiera sårbarheter som är ett bra komplement. Vi anser trots dessa åtgärder att vi inte kan vara helt säkra på applikationens säkerhet och rekommenderar att utvecklare granskar koden och genomför regelbunden utvärdering av applikationens säkerhetsposition.
