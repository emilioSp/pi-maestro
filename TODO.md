# TODO

AGENT DO NOT READ HERE. THIS IS FOR ME

~~## Findings must remain in the history, same escalations behavior~~

## Renumbered the criteria from AC1 to AC13, with no gaps. Their content is unchanged.

## Check subagent available extension when Maestro is activated

## Maestro init

## Maestro can change model for builder and verifier in spec preparation and ready for builder phases

## Reconciliacion

~~## Escalation in builder handoff~~

## Remove failed status --> replace with escalation

~~## Add test coverage~~

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
