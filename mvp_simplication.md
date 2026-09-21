# Semplificazioni MVP

Questo documento riassume le semplificazioni approvate per i Task 9–44. I task precedenti restano invariati.

## Git e worktree

1. **Collisioni:** Maestro si ferma alla prima collisione di branch, percorso o worktree. Non raccoglie tutte le collisioni prima di restituire l’errore.
2. **Cronologia Git:** Maestro verifica solo commit esatto, parent, ancestor, merge-base e possibilità di fast-forward. Non ricostruisce il commit di approvazione, non prova la raggiungibilità Git di ogni artefatto e non esegue analisi forense di cronologie riscritte.

## Test di schema e stato

3. **Schemi chiusi:** gli schemi continuano a rifiutare campi sconosciuti, ma i test usano casi rappresentativi per i confini principali invece di verificare ogni campo annidato.
4. **Transizioni:** i test coprono un percorso normale, un retry, un reset della spec, una revisione stale, l’incremento monotono della revisione e l’immutabilità dell’input. Non enumerano tutte le transizioni o i salti vietati.
5. **Autorizzazione dei ruoli:** resta negli allowlist dei tool e negli adapter. La funzione pura delle transizioni non riceve o valida l’actor.

## Discovery e recovery

6. **Riconciliazione:** Maestro controlla solo il workflow attivo e le sue risorse attese: stato, branch, worktree, HEAD e artefatto terminale. Non scansiona globalmente branch, worktree o revisioni precedenti.
7. **Restart:** dopo un restart, una fase builder o verifier senza handoff terminale è considerata interrotta. Maestro non tenta di riconnettersi al processo precedente.
8. **Retry:** il retry resta esplicito e viene permesso solo quando il worktree è pulito.
9. **Resume:** dopo `/resume`, Maestro resta inattivo. L’owner usa `/maestro` per eseguire i normali controlli e riattivarlo.

## Spec e observations

10. **Creazione parziale:** se la creazione iniziale della spec fallisce, Maestro lascia i file già creati e segnala il percorso. L’owner esegue la pulizia manuale prima del retry.
11. **Observations:** l’API valida la storia esistente e aggiunge il nuovo passaggio. Non esegue un confronto separato per dimostrare che la storia precedente è rimasta equivalente.
12. **Reset della spec:** il reset della stessa spec resta nell’MVP. Non viene sostituito da abbandono manuale e nuovo spec ID.

## Verifier e finding

13. **Modifiche del verifier:** `PRODUCT_FILES_MODIFIED` contiene solo il codice errore e un messaggio chiaro. Non restituisce conteggi, percorsi, diff o comandi Git suggeriti.
14. **Decisioni sui finding:** i test coprono tutti respinti, almeno un `fix-code` e almeno un `revise-spec`. Non enumerano tutte le combinazioni miste.

## Final review

15. **Cleanup:** dopo lo staging verificato, Maestro scrive e mette in staging `final-review`, poi tenta il cleanup best-effort di branch e worktree.
16. **Errore di cleanup:** viene riportato e richiede pulizia manuale, ma non annulla lo staging o `final-review` e non riapre il workflow.

## Pi e attivazione

17. **Lifecycle dei subagent:** Maestro usa risultato foreground e timeout delle API pubbliche di `pi-subagents`. Non duplica tracking delle richieste, cancellazione o cleanup dei listener.
18. **Correlazione:** Maestro conserva la revisione del workflow e valida l’handoff quando il subagent ritorna.
19. **Attivazione:** i controlli si fermano al primo errore e mostrano un messaggio chiaro. Non aggregano tutti gli errori disponibili.

## Strategia di test

20. **Tool adapter:** i test coprono schema input, derivazione dei campi, wiring di un successo e propagazione di un errore. La matrice comportamentale completa resta nei moduli di dominio.
21. **End-to-end:** la suite contiene un happy path completo e un percorso di recovery con retry esplicito. Gli altri edge case restano nei test dei moduli proprietari.
