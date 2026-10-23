# Standard di Isolamento Canali e Permessi Discord

1. Integrità Assoluta di @everyone:
   - Non modificare MAI le permission overwrites del ruolo @everyone per l'isolamento dei non verificati.
   - @everyone deve rimanere nello stato neutrale predefinito del server.

2. Isolamento su ID Membro Individuale:
   - Applicare le restrizioni di canale (ViewChannel: false) esclusivamente sull'ID del singolo utente (member.id) o su ruoli temporanei dedicati creati appositamente.
   - Al completamento della verifica, eliminare tempestivamente gli overwrite personali per far ricomparire i canali e mantenere pulita la tabella dei permessi.

3. Ottimizzazione delle Chiamate API:
   - Applicare gli overwrite prioritariamente alle Categorie genitore piuttosto che a ogni singolo canale figlio per ridurre le chiamate REST, evitare il rate limit e rispettare il tetto massimo di 100 overwrites per canale stabilito da Discord.
