import { isoLocal, nowISO, toast } from './utils.js';
import { saveState } from './storage.js';

export const runAutoCarryOver = (state) => {
    const today = isoLocal();
    let movedCount = 0;

    state.tasks.forEach(task => {
        // Si la tâche n'est pas faite ET que sa date est passée (inférieure à today)
        if (!task.done && task.date < today) {
            // On la déplace à Aujourd'hui automatiquement
            task.date = today;
            task.updatedAt = nowISO();
            // On peut ajouter un petit flag discret pour savoir qu'elle a été reportée si besoin
            task.wasCarriedOver = true;
            movedCount++;
        }
    });

    if (movedCount > 0) {
        saveState(state);
    }

    return movedCount;
};
