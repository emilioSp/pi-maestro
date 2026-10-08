# TODO

AGENT DO NOT READ HERE. THIS IS FOR ME

~~## Findings must remain in the history, same escalations behavior~~

## Allow builder failure when all acceptance criteria pass

### Example

All acceptance criteria in the approved spec pass. A separate mandatory repository check, such as lint, fails. The builder cannot fix that failure within the pass, and no owner decision is needed.

The builder cannot report `done` because a required check fails. It must report `failed` while preserving the successful acceptance results.

### Restriction

`src/artifacts/builder-handoff/assertBuilderHandoff.ts` rejects a `failed` handoff when its nonempty acceptance criterion list contains only `probeStatus: passed`.

The tool reports: `Failed builder handoff cannot mark every acceptance check as completed.`

This prevents the builder from recording an honest failure in this case. The builder must report the protocol limitation to Maestro instead of changing successful results or omitting criteria.

### Correction

Allow `status: failed` even when every acceptance criterion passes. Keep `failure.reason` mandatory and preserve the actual criterion results.

Update the validator and its tests to cover this case. Remove the corresponding limitation from `agents/builder.md` after the correction. Keep the existing completion requirements for `status: done`.

## Renumbered the criteria from AC1 to AC13, with no gaps. Their content is unchanged.

## Check subagent available extension when Maestro is activated

## Maestro init

## Maestro can change model for builder and verifier in spec preparation and ready for builder phases

## Reconciliacion

## Escalation in builder handoff

## Remove failed status --> replace with escalation

## Add test coverage

## ensure spec ac implementation and verification

Una funzione estrae gli ID da titoli con un formato fisso, per esempio ### AC1: .... Alla submission del builder e del verifier confronti gli ID della spec con quelli dell’handoff:

* Nessun criterio mancante.
* Nessun criterio aggiunto.
* Nessun duplicato, anche nella spec.

Se il controllo fallisce, rifiuti l’handoff prima di salvare il report e cambiare fase.

## Limit verifier modification 

TODO: ridurre le modifiche temporanee del verifier

Aggiornare le istruzioni del verifier:

* Preferire prove che non modificano i file esistenti.
* Usare file temporanei separati quando possibile.
* Modificare un file esistente solo quando serve per verificare un criterio.
* Prima della modifica, conservare il contenuto originale esatto.
* Ripristinare i file subito dopo ogni prova, anche se fallisce.
* Non usare comandi con correzioni automatiche quando esiste una modalità di solo controllo.
* Prima dell’handoff, controllare che ogni modifica temporanea sia stata ripristinata e ogni file temporaneo creato sia stato rimosso.
* Se il ripristino non riesce, fermarsi e riportare i percorsi e le modifiche residue.

Queste istruzioni riducono il rischio. Il controllo degli hash rileva gli eventuali errori di ripristino.
