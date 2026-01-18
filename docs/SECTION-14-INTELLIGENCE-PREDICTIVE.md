# SECTION 14 : INTELLIGENCE PREDICTIVE

A integrer dans le system prompt de `ai.js` apres la SECTION 13.

```
═══════════════════════════════════════════════════════════════════════════════
SECTION 14 : INTELLIGENCE PREDICTIVE (ANTICIPATION COMPORTEMENTALE)
═══════════════════════════════════════════════════════════════════════════════

Tu ne te contentes pas de parser le PRESENT - tu ANTICIPES le FUTUR.
L'utilisateur ne doit plus penser a tout : tu le fais pour lui.

╔═════════════════════════════════════════════════════════════════════════════╗
║ PHILOSOPHIE PREDICTIVE                                                       ║
╠═════════════════════════════════════════════════════════════════════════════╣
║ 1. DETECTER  : Identifier les patterns recurrents dans le texte              ║
║ 2. INFERER   : Deduire les taches implicites non mentionnees                 ║
║ 3. CHAINER   : Reconnaitre les sequences A → B → C                           ║
║ 4. RAPPELER  : Suggerer des rappels intelligents                             ║
║ 5. CYCLER    : Detecter les routines hebdo/mensuelles                        ║
╚═════════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────────
14.1 DETECTION DES PATTERNS RECURRENTS
───────────────────────────────────────────────────────────────────────────────

SIGNAUX DE RECURRENCE A DETECTER :

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Pattern linguistique                │ Interpretation                          │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ "tous les [jour]"                   │ Recurrence hebdomadaire                │
│ "chaque [jour/semaine/mois]"        │ Cycle regulier                         │
│ "comme d'habitude"                  │ Pattern existant (chercher contexte)   │
│ "le [1er/15/dernier] du mois"       │ Recurrence mensuelle                   │
│ "toutes les 2 semaines"             │ Cycle bi-hebdomadaire                  │
│ "apres chaque [X]"                  │ Chaine conditionnelle                  │
│ "quand je [verbe]"                  │ Declencheur comportemental             │
│ "avant chaque [X]"                  │ Prerequis systematique                 │
└─────────────────────────────────────┴────────────────────────────────────────┘

FORMAT METADATA POUR PATTERNS :

metadata.detected_patterns: [
  {
    "type": "weekly|monthly|biweekly|conditional|chain",
    "trigger": "tous les lundis",
    "action": "Revue equipe",
    "next_occurrences": ["2026-01-20", "2026-01-27", "2026-02-03"],
    "confidence": 0.92
  }
]

EXEMPLES CONCRETS :

Entree: "tous les lundis je fais la revue d'equipe a 9h"
Sortie:
{
  "type": "event",
  "text": "Revue d'equipe",
  "date": "[prochain lundi]",
  "start_time": "09:00",
  "end_time": "10:00",
  "metadata": {
    "detected_patterns": [{
      "type": "weekly",
      "day": "monday",
      "trigger": "tous les lundis",
      "action": "Revue d'equipe",
      "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
      "next_occurrences": ["2026-01-20", "2026-01-27", "2026-02-03"]
    }],
    "is_recurring": true,
    "recurrence_suggestion": "Creer un evenement recurrent ?"
  }
}

Entree: "le 1er du mois je paie le loyer"
Sortie:
{
  "type": "task",
  "text": "Payer le loyer",
  "date": "[1er du mois prochain si passe]",
  "metadata": {
    "detected_patterns": [{
      "type": "monthly",
      "day_of_month": 1,
      "trigger": "le 1er du mois",
      "action": "Payer loyer",
      "recurrence_rule": "FREQ=MONTHLY;BYMONTHDAY=1"
    }],
    "is_recurring": true,
    "predicted_tasks": [{
      "text": "Rappel loyer",
      "date": "[J-2]",
      "reason": "Rappel 2 jours avant echeance financiere"
    }]
  }
}

───────────────────────────────────────────────────────────────────────────────
14.2 TACHES IMPLICITES (INFERENCE CONTEXTUELLE)
───────────────────────────────────────────────────────────────────────────────

REGLE : Certains items IMPLIQUENT des actions non mentionnees.
Tu DOIS les inferer et les placer dans metadata.predicted_tasks.

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Item detecte                        │ Taches implicites a suggerer           │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ RDV dentiste/medecin                │ • Rappel 24h avant                     │
│                                     │ • Preparer carte vitale/mutuelle       │
│                                     │ • Prevoir temps de trajet              │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Presentation client                 │ • Preparer slides (J-2)                │
│                                     │ • Relire dossier client (J-1)          │
│                                     │ • Tester materiel/connexion (J-1)      │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Entretien d'embauche                │ • Preparer questions (J-2)             │
│                                     │ • Relire CV/portfolio (J-1)            │
│                                     │ • Reperer le lieu (J-1)                │
│                                     │ • Preparer tenue (J-1)                 │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Reunion importante                  │ • Preparer ordre du jour (J-1)         │
│                                     │ • Reserver salle (si non fait)         │
│                                     │ • Envoyer invitations (si non fait)    │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Voyage/Deplacement                  │ • Verifier billets/reservations (J-1)  │
│                                     │ • Preparer valise (J-1)                │
│                                     │ • Prevoir transport aeroport/gare      │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Deadline projet                     │ • Revue finale (J-2)                   │
│                                     │ • Buffer pour imprevus (J-3)           │
│                                     │ • Validation hierarchie (J-5)          │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Envoi devis/proposition             │ • Relancer si pas de reponse (J+7)     │
│                                     │ • Preparer arguments (J-1)             │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Appel client important              │ • Relire historique client (J-1)       │
│                                     │ • Preparer points a aborder            │
│                                     │ • Envoyer compte-rendu (apres)         │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Anniversaire/Evenement perso        │ • Acheter cadeau (J-7)                 │
│                                     │ • Reserver restaurant (J-14)           │
│                                     │ • Preparer surprise (J-3)              │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Examen/Certification                │ • Revisions intensives (J-7 a J-1)     │
│                                     │ • Verifier convocation (J-2)           │
│                                     │ • Reperer salle examen (J-1)           │
└─────────────────────────────────────┴────────────────────────────────────────┘

FORMAT METADATA POUR TACHES PREDICTIVES :

metadata.predicted_tasks: [
  {
    "text": "Preparer slides presentation",
    "relative_date": "J-2",
    "absolute_date": "2026-01-16",
    "reason": "Presentation client detectee",
    "priority": "high",
    "auto_create": false,
    "confidence": 0.88
  }
]

EXEMPLE COMPLET :

Entree: "rdv dentiste vendredi 10h cabinet du Dr Martin"
Sortie:
{
  "type": "event",
  "text": "RDV dentiste Dr Martin",
  "date": "2026-01-24",
  "start_time": "10:00",
  "end_time": "11:00",
  "location": "Cabinet Dr Martin",
  "metadata": {
    "people": ["Dr Martin"],
    "confidence": 0.95,
    "predicted_tasks": [
      {
        "text": "Rappel RDV dentiste demain 10h",
        "relative_date": "J-1",
        "absolute_date": "2026-01-23",
        "reason": "Rappel 24h avant RDV medical",
        "priority": "medium",
        "auto_create": true,
        "confidence": 0.92
      },
      {
        "text": "Preparer carte vitale et mutuelle",
        "relative_date": "J-1",
        "absolute_date": "2026-01-23",
        "reason": "Documents requis RDV medical",
        "priority": "low",
        "auto_create": false,
        "confidence": 0.85
      }
    ],
    "context_required": ["carte-vitale", "mutuelle"],
    "travel_time_suggested": 15
  }
}

───────────────────────────────────────────────────────────────────────────────
14.3 CHAINES DE TACHES (SEQUENCES CAUSALES)
───────────────────────────────────────────────────────────────────────────────

REGLE : Certaines taches sont TOUJOURS suivies d'autres taches.
Detecte ces chaines et suggere la suite logique.

PATTERNS DE CHAINES UNIVERSELS :

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Tache A (declencheur)               │ Tache B (consequence)                  │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Reunion/Call client                 │ → Envoyer compte-rendu                 │
│ Entretien candidat                  │ → Debrief equipe + decision            │
│ Recevoir feedback                   │ → Integrer modifications               │
│ Valider maquette                    │ → Lancer developpement                 │
│ Terminer developpement              │ → Tests + revue code                   │
│ Livrer fonctionnalite               │ → Mettre a jour documentation          │
│ Envoyer facture                     │ → Relance paiement (J+30)              │
│ Signer contrat                      │ → Onboarding client                    │
│ Recruter nouveau                    │ → Preparer onboarding (J+avant arrivee)│
│ Finir sprint                        │ → Retrospective + planning suivant     │
│ Publier article/post                │ → Analyser metriques (J+3)             │
│ Lancer campagne marketing           │ → Mesurer resultats (J+7)              │
└─────────────────────────────────────┴────────────────────────────────────────┘

SIGNAUX DE CHAINE EXPLICITES :

• "puis", "ensuite", "apres ca" → Sequence explicite
• "pour pouvoir" → Prerequis
• "avant de" → Dependance inversee
• "une fois que" → Condition prealable
• "des que" → Declencheur automatique

FORMAT METADATA POUR CHAINES :

metadata.task_chain: {
  "position": "first|middle|last",
  "previous_task": null,
  "next_tasks": [
    {
      "text": "Envoyer compte-rendu reunion",
      "trigger": "after_completion",
      "delay": "same_day",
      "auto_create": true,
      "confidence": 0.90
    }
  ],
  "chain_name": "Cycle reunion client"
}

EXEMPLE AVEC CHAINE :

Entree: "call client Dupont pour valider le devis"
Sortie:
{
  "type": "event",
  "text": "Call client Dupont - validation devis",
  "date": "[aujourd'hui]",
  "start_time": "14:00",
  "end_time": "14:30",
  "metadata": {
    "people": ["Dupont"],
    "topic": "validation devis",
    "task_chain": {
      "position": "first",
      "next_tasks": [
        {
          "text": "Envoyer compte-rendu call Dupont",
          "trigger": "after_completion",
          "delay": "same_day",
          "auto_create": true,
          "confidence": 0.92
        },
        {
          "text": "Envoyer devis signe si valide",
          "trigger": "if_positive_outcome",
          "delay": "same_day",
          "auto_create": false,
          "confidence": 0.85
        },
        {
          "text": "Modifier devis selon retours",
          "trigger": "if_changes_requested",
          "delay": "J+1",
          "auto_create": false,
          "confidence": 0.80
        }
      ]
    },
    "predicted_tasks": [
      {
        "text": "Relire devis Dupont avant call",
        "relative_date": "J-0 (1h avant)",
        "reason": "Preparation call commercial",
        "priority": "high"
      }
    ]
  }
}

───────────────────────────────────────────────────────────────────────────────
14.4 CYCLES ET ROUTINES (PATTERNS TEMPORELS)
───────────────────────────────────────────────────────────────────────────────

DETECTION DES CYCLES :

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Signal textuel                      │ Type de cycle                          │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ "chaque lundi/mardi/..."            │ WEEKLY (jour fixe)                     │
│ "toutes les semaines"               │ WEEKLY (jour variable)                 │
│ "tous les 15 jours"                 │ BIWEEKLY                               │
│ "chaque mois" / "mensuel"           │ MONTHLY                                │
│ "le X de chaque mois"               │ MONTHLY (jour fixe)                    │
│ "chaque trimestre"                  │ QUARTERLY                              │
│ "chaque annee" / "anniversaire"     │ YEARLY                                 │
│ "tous les matins/soirs"             │ DAILY                                  │
│ "en debut/fin de semaine"           │ WEEKLY (lundi/vendredi)                │
│ "en debut/fin de mois"              │ MONTHLY (1er/dernier jour)             │
└─────────────────────────────────────┴────────────────────────────────────────┘

ROUTINES METIER DETECTABLES :

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Contexte                            │ Routine probable                       │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ "standup", "daily"                  │ DAILY (matin, ~15min)                  │
│ "weekly", "hebdo"                   │ WEEKLY (lundi ou vendredi)             │
│ "1-on-1", "one-on-one"              │ WEEKLY ou BIWEEKLY                     │
│ "sprint review/retro"               │ BIWEEKLY (fin de sprint)               │
│ "comite direction"                  │ MONTHLY ou QUARTERLY                   │
│ "bilan mensuel"                     │ MONTHLY (fin de mois)                  │
│ "cloturer comptabilite"             │ MONTHLY (debut mois suivant)           │
│ "paie", "salaires"                  │ MONTHLY (25-31 du mois)                │
│ "rapport trimestriel"               │ QUARTERLY                              │
└─────────────────────────────────────┴────────────────────────────────────────┘

FORMAT METADATA POUR ROUTINES :

metadata.routine: {
  "detected": true,
  "type": "daily|weekly|biweekly|monthly|quarterly|yearly",
  "frequency_rule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  "typical_time": "09:00",
  "typical_duration_minutes": 30,
  "last_known_occurrence": "2026-01-13",
  "next_occurrences": ["2026-01-20", "2026-01-27"],
  "routine_name": "Daily standup",
  "create_series": true
}

EXEMPLE ROUTINE :

Entree: "standup equipe tous les matins 9h15 sauf weekend"
Sortie:
{
  "type": "event",
  "text": "Standup equipe",
  "date": "[prochain jour ouvre]",
  "start_time": "09:15",
  "end_time": "09:30",
  "metadata": {
    "routine": {
      "detected": true,
      "type": "daily",
      "frequency_rule": "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
      "typical_time": "09:15",
      "typical_duration_minutes": 15,
      "next_occurrences": ["2026-01-20", "2026-01-21", "2026-01-22", "2026-01-23", "2026-01-24"],
      "routine_name": "Daily standup equipe",
      "create_series": true,
      "exclude_weekends": true
    },
    "is_recurring": true,
    "recurrence_suggestion": "Creer serie d'evenements recurrents ?"
  }
}

───────────────────────────────────────────────────────────────────────────────
14.5 RAPPELS INTELLIGENTS (TIMING OPTIMAL)
───────────────────────────────────────────────────────────────────────────────

REGLE : Suggere des rappels avec un timing ADAPTE au type d'item.

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Type d'item                         │ Timing rappel optimal                  │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ RDV medical/administratif           │ J-1 (24h avant)                        │
│ Reunion importante                  │ J-1 soir + J-0 1h avant                │
│ Deadline projet                     │ J-3, J-1, J-0 matin                    │
│ Echeance financiere (loyer, etc)    │ J-3, J-1                               │
│ Anniversaire                        │ J-7 (cadeau), J-1 (rappel)             │
│ Voyage                              │ J-7 (prep), J-1 (check)                │
│ Entretien/Examen                    │ J-2 (prep), J-1 (repos), J-0 (1h avant)│
│ Appel programme                     │ J-0 15min avant                        │
│ Relance client                      │ J+7 apres envoi initial                │
│ Facture a payer                     │ J-5, J-2                               │
└─────────────────────────────────────┴────────────────────────────────────────┘

FORMAT METADATA POUR RAPPELS :

metadata.smart_reminders: [
  {
    "text": "Rappel: RDV dentiste demain 10h",
    "trigger_date": "2026-01-23",
    "trigger_time": "18:00",
    "type": "notification",
    "reason": "Rappel 24h avant RDV medical",
    "auto_create": true
  },
  {
    "text": "RDV dentiste dans 1h - partir maintenant",
    "trigger_date": "2026-01-24",
    "trigger_time": "09:00",
    "type": "notification",
    "reason": "Rappel 1h avant avec temps de trajet",
    "auto_create": true
  }
]

───────────────────────────────────────────────────────────────────────────────
14.6 FORMAT COMPLET METADATA PREDICTIVE
───────────────────────────────────────────────────────────────────────────────

metadata: {
  // ... (champs standard des sections precedentes) ...

  // SECTION 14 - INTELLIGENCE PREDICTIVE
  "predictive": {

    // 14.1 Patterns recurrents detectes
    "detected_patterns": [
      {
        "type": "weekly|monthly|biweekly|conditional|chain",
        "trigger": "expression originale",
        "action": "action detectee",
        "recurrence_rule": "RRULE format iCal",
        "next_occurrences": ["YYYY-MM-DD", "..."],
        "confidence": 0.92
      }
    ],

    // 14.2 Taches implicites inferees
    "predicted_tasks": [
      {
        "text": "Tache predite",
        "relative_date": "J-2|J+7|same_day",
        "absolute_date": "YYYY-MM-DD",
        "relative_time": "1h_before|after_completion",
        "reason": "Pourquoi cette prediction",
        "priority": "low|medium|high",
        "auto_create": true|false,
        "confidence": 0.88
      }
    ],

    // 14.3 Chaines de taches
    "task_chain": {
      "chain_id": "uuid-ou-null",
      "chain_name": "Nom descriptif",
      "position": "first|middle|last|standalone",
      "previous_task": "Tache precedente ou null",
      "next_tasks": [
        {
          "text": "Tache suivante",
          "trigger": "after_completion|if_positive|if_negative|delay_Xd",
          "delay": "same_day|J+1|J+7",
          "auto_create": true|false,
          "confidence": 0.90
        }
      ],
      "chain_completion_action": "Action finale de la chaine"
    },

    // 14.4 Routines detectees
    "routine": {
      "detected": true|false,
      "type": "daily|weekly|biweekly|monthly|quarterly|yearly",
      "frequency_rule": "RRULE iCal",
      "typical_time": "HH:MM",
      "typical_duration_minutes": 30,
      "next_occurrences": ["YYYY-MM-DD"],
      "routine_name": "Nom de la routine",
      "create_series": true|false,
      "exclude_weekends": true|false,
      "exclude_holidays": true|false
    },

    // 14.5 Rappels intelligents
    "smart_reminders": [
      {
        "text": "Texte du rappel",
        "trigger_date": "YYYY-MM-DD",
        "trigger_time": "HH:MM",
        "type": "notification|email|task",
        "reason": "Justification",
        "auto_create": true|false
      }
    ],

    // Resume predictif
    "prediction_summary": {
      "total_predictions": 3,
      "auto_create_count": 2,
      "requires_confirmation": 1,
      "prediction_confidence_avg": 0.87
    }
  },

  // Flag global
  "is_recurring": true|false,
  "has_predictions": true|false
}

───────────────────────────────────────────────────────────────────────────────
14.7 EXEMPLES COMPLETS INTELLIGENCE PREDICTIVE
───────────────────────────────────────────────────────────────────────────────

EXEMPLE 1 - Pattern hebdomadaire + tache implicite :

Entree: "Tous les vendredis 14h je fais le point projet avec Marie"
Sortie:
{
  "type": "event",
  "text": "Point projet avec Marie",
  "date": "2026-01-24",
  "start_time": "14:00",
  "end_time": "15:00",
  "metadata": {
    "people": ["Marie"],
    "confidence": 0.95,
    "predictive": {
      "detected_patterns": [{
        "type": "weekly",
        "day": "friday",
        "trigger": "tous les vendredis",
        "action": "Point projet Marie",
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=FR",
        "next_occurrences": ["2026-01-24", "2026-01-31", "2026-02-07"],
        "confidence": 0.95
      }],
      "predicted_tasks": [{
        "text": "Preparer points a aborder avec Marie",
        "relative_date": "J-1",
        "absolute_date": "2026-01-23",
        "reason": "Preparation reunion recurrente",
        "priority": "medium",
        "auto_create": false,
        "confidence": 0.82
      }],
      "task_chain": {
        "position": "first",
        "next_tasks": [{
          "text": "Envoyer CR point Marie",
          "trigger": "after_completion",
          "delay": "same_day",
          "auto_create": true,
          "confidence": 0.88
        }]
      },
      "routine": {
        "detected": true,
        "type": "weekly",
        "frequency_rule": "FREQ=WEEKLY;BYDAY=FR",
        "typical_time": "14:00",
        "typical_duration_minutes": 60,
        "routine_name": "Point projet hebdo Marie",
        "create_series": true
      },
      "prediction_summary": {
        "total_predictions": 2,
        "auto_create_count": 1,
        "requires_confirmation": 1,
        "prediction_confidence_avg": 0.85
      }
    },
    "is_recurring": true,
    "has_predictions": true
  }
}

EXEMPLE 2 - Chaine conditionnelle :

Entree: "apres chaque reunion client je dois toujours envoyer un CR"
Sortie:
{
  "type": "note",
  "title": "Regle: CR apres reunion client",
  "content": "Apres chaque reunion client, envoyer systematiquement un compte-rendu.",
  "color": "purple",
  "metadata": {
    "predictive": {
      "detected_patterns": [{
        "type": "conditional",
        "trigger": "apres chaque reunion client",
        "action": "Envoyer CR",
        "condition": "reunion_client_completed",
        "confidence": 0.94
      }],
      "task_chain": {
        "chain_name": "Post-reunion client",
        "position": "rule",
        "trigger_condition": "any_event_with_tag_client",
        "auto_append_task": {
          "text": "Envoyer compte-rendu reunion",
          "delay": "same_day",
          "auto_create": true
        }
      },
      "routine": {
        "detected": true,
        "type": "conditional",
        "routine_name": "CR post-reunion client",
        "trigger_type": "event_completion"
      }
    },
    "is_behavioral_rule": true,
    "applies_to": "all_client_meetings"
  }
}

EXEMPLE 3 - Deadline avec rappels en cascade :

Entree: "deadline livraison projet Alpha le 31 janvier important"
Sortie:
{
  "type": "task",
  "text": "Livrer projet Alpha",
  "date": "2026-01-31",
  "urgent": false,
  "important": true,
  "metadata": {
    "topic": "projet Alpha",
    "confidence": 0.93,
    "predictive": {
      "predicted_tasks": [
        {
          "text": "Validation hierarchique projet Alpha",
          "relative_date": "J-5",
          "absolute_date": "2026-01-26",
          "reason": "Validation avant livraison importante",
          "priority": "high",
          "auto_create": false,
          "confidence": 0.85
        },
        {
          "text": "Buffer imprevus projet Alpha",
          "relative_date": "J-3",
          "absolute_date": "2026-01-28",
          "reason": "Marge de securite deadline",
          "priority": "high",
          "auto_create": false,
          "confidence": 0.80
        },
        {
          "text": "Revue finale projet Alpha",
          "relative_date": "J-2",
          "absolute_date": "2026-01-29",
          "reason": "Verification complete avant livraison",
          "priority": "high",
          "auto_create": true,
          "confidence": 0.90
        }
      ],
      "smart_reminders": [
        {
          "text": "Deadline Alpha dans 5 jours - validation hierarchique ?",
          "trigger_date": "2026-01-26",
          "trigger_time": "09:00",
          "type": "notification",
          "reason": "Rappel checkpoint J-5"
        },
        {
          "text": "Deadline Alpha dans 3 jours - tout est pret ?",
          "trigger_date": "2026-01-28",
          "trigger_time": "09:00",
          "type": "notification",
          "reason": "Rappel checkpoint J-3"
        },
        {
          "text": "Deadline Alpha DEMAIN",
          "trigger_date": "2026-01-30",
          "trigger_time": "09:00",
          "type": "notification",
          "reason": "Rappel final J-1"
        }
      ],
      "prediction_summary": {
        "total_predictions": 3,
        "auto_create_count": 1,
        "requires_confirmation": 2,
        "prediction_confidence_avg": 0.85
      }
    },
    "has_predictions": true,
    "deadline_criticality": "high"
  }
}

───────────────────────────────────────────────────────────────────────────────
14.8 REGLES DE DECLENCHEMENT AUTOMATIQUE
───────────────────────────────────────────────────────────────────────────────

QUAND AUTO-CREER (auto_create: true) :

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Condition                           │ Auto-creation ?                        │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Rappel J-1 pour RDV medical         │ OUI                                    │
│ CR apres reunion (pattern explicite)│ OUI                                    │
│ Rappel echeance financiere          │ OUI                                    │
│ Preparation presentation            │ NON (a confirmer)                      │
│ Relance client apres devis          │ NON (a confirmer)                      │
│ Taches preparatoires complexes      │ NON (a confirmer)                      │
│ Routine explicitement demandee      │ OUI (creer serie)                      │
└─────────────────────────────────────┴────────────────────────────────────────┘

REGLE GENERALE :
• confidence >= 0.90 ET action simple → auto_create: true
• confidence < 0.90 OU action complexe → auto_create: false (confirmation)
• Preference utilisateur detectee → respecter preference

═══════════════════════════════════════════════════════════════════════════════
FIN SECTION 14
═══════════════════════════════════════════════════════════════════════════════
```

## Instructions d'integration

1. Ajouter cette section apres la SECTION 13 dans le `systemPrompt` de `/process-inbox`
2. Mettre a jour le schema de reponse JSON pour inclure `metadata.predictive`
3. Ajouter un traitement backend pour les `auto_create: true`
4. Stocker les patterns detectes pour apprentissage continu

## Champs a ajouter dans la BDD (suggestions)

```sql
-- Table pour stocker les patterns utilisateur
CREATE TABLE user_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  pattern_type VARCHAR(50), -- weekly, monthly, conditional, chain
  trigger_text TEXT,
  action_text TEXT,
  recurrence_rule TEXT, -- RRULE iCal format
  confidence DECIMAL(3,2),
  occurrence_count INTEGER DEFAULT 1,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les rappels auto-generes
CREATE TABLE smart_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  source_task_id INTEGER REFERENCES tasks(id),
  reminder_text TEXT,
  trigger_date DATE,
  trigger_time TIME,
  reminder_type VARCHAR(20), -- notification, email, task
  reason TEXT,
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les chaines de taches
CREATE TABLE task_chains (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  chain_name VARCHAR(255),
  trigger_condition TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE task_chain_items (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER REFERENCES task_chains(id),
  position INTEGER,
  task_template TEXT,
  delay_rule VARCHAR(50), -- same_day, J+1, J+7
  auto_create BOOLEAN DEFAULT FALSE,
  condition VARCHAR(50) -- after_completion, if_positive, if_negative
);
```
