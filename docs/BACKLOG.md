# Stokeya — Backlog Produit

## Épics & User Stories

### EPIC-01 — Authentification & Sécurité
| ID | User Story | Priorité |
|----|-----------|----------|
| US-01.1 | En tant qu'admin entreprise, je veux créer un compte entreprise pour démarrer sur Stokeya | Must |
| US-01.2 | En tant qu'utilisateur, je veux me connecter avec email/téléphone + mot de passe | Must |
| US-01.3 | En tant qu'utilisateur, je veux recevoir un JWT pour accéder à l'API de façon sécurisée | Must |
| US-01.4 | En tant qu'utilisateur, je veux réinitialiser mon mot de passe oublié | Must |
| US-01.5 | En tant qu'admin, je veux assigner des rôles (caissier, magasinier, comptable…) | Must |
| US-01.6 | En tant que super admin SaaS, je veux gérer toutes les entreprises abonnées | Should |
| US-01.7 | En tant qu'admin, je veux consulter le journal d'audit des actions sensibles | Should |

### EPIC-02 — Multi-entreprise & Multi-boutiques
| ID | User Story | Priorité |
|----|-----------|----------|
| US-02.1 | En tant qu'admin, je veux configurer mon entreprise (nom, logo, devise, TVA) | Must |
| US-02.2 | En tant qu'admin, je veux créer plusieurs boutiques/magasins | Must |
| US-02.3 | En tant qu'admin, je veux créer des entrepôts liés à chaque boutique | Must |
| US-02.4 | En tant qu'admin, je veux ouvrir/fermer une caisse par boutique | Must |
| US-02.5 | En tant qu'utilisateur, je veux basculer entre boutiques selon mes droits | Should |

### EPIC-03 — Catalogue Produits
| ID | User Story | Priorité |
|----|-----------|----------|
| US-03.1 | En tant que gérant, je veux créer/modifier/supprimer des produits | Must |
| US-03.2 | En tant que gérant, je veux ajouter une image et un code-barres par produit | Must |
| US-03.3 | En tant que gérant, je veux définir prix achat, prix vente et TVA | Must |
| US-03.4 | En tant que gérant, je veux organiser les produits par catégories et marques | Must |
| US-03.5 | En tant que gérant, je veux définir stock min/max et unité de mesure | Must |
| US-03.6 | En tant que gérant, je veux gérer des variantes (taille, couleur) | Should |
| US-03.7 | En tant que gérant, je veux gérer les lots et dates d'expiration | Should |
| US-03.8 | En tant que gérant, je veux définir des prix par boutique ou canal | Could |

### EPIC-04 — Gestion du Stock
| ID | User Story | Priorité |
|----|-----------|----------|
| US-04.1 | En tant que magasinier, je veux enregistrer une entrée de stock | Must |
| US-04.2 | En tant que magasinier, je veux enregistrer une sortie de stock | Must |
| US-04.3 | En tant que magasinier, je veux transférer du stock entre entrepôts | Must |
| US-04.4 | En tant que magasinier, je veux faire un inventaire physique et ajuster | Must |
| US-04.5 | En tant que gérant, je veux voir l'historique des mouvements de stock | Must |
| US-04.6 | En tant que gérant, je veux recevoir une alerte quand le stock est faible | Must |
| US-04.7 | En tant que gérant, je veux bloquer la vente de lots expirés | Should |

### EPIC-05 — Point de Vente (POS)
| ID | User Story | Priorité |
|----|-----------|----------|
| US-05.1 | En tant que caissier, je veux vendre rapidement via une interface caisse | Must |
| US-05.2 | En tant que caissier, je veux scanner un code-barres pour ajouter un produit | Must |
| US-05.3 | En tant que caissier, je veux encaisser en espèces, mobile money ou carte | Must |
| US-05.4 | En tant que caissier, je veux imprimer/partager un ticket de caisse | Must |
| US-05.5 | En tant que caissier, je veux annuler ou retourner une vente | Must |
| US-05.6 | En tant que caissier, je veux appliquer une remise sur une vente | Should |
| US-05.7 | En tant que caissier, je veux vendre à crédit à un client enregistré | Should |
| US-05.8 | En tant que caissier, je veux travailler hors ligne et synchroniser plus tard | Must |

### EPIC-06 — Achats & Fournisseurs
| ID | User Story | Priorité |
|----|-----------|----------|
| US-06.1 | En tant que gérant, je veux gérer la fiche fournisseur | Must |
| US-06.2 | En tant que gérant, je veux créer un bon de commande fournisseur | Must |
| US-06.3 | En tant que magasinier, je veux réceptionner une commande et mettre à jour le stock | Must |
| US-06.4 | En tant que comptable, je veux enregistrer les paiements fournisseurs | Should |
| US-06.5 | En tant que gérant, je veux voir l'historique des achats par fournisseur | Must |

### EPIC-07 — Clients & Fidélité
| ID | User Story | Priorité |
|----|-----------|----------|
| US-07.1 | En tant que caissier, je veux enregistrer un client lors d'une vente | Must |
| US-07.2 | En tant que gérant, je veux voir l'historique d'achats d'un client | Must |
| US-07.3 | En tant que gérant, je veux gérer les crédits/dettes clients | Should |
| US-07.4 | En tant que gérant, je veux un programme de fidélité (points) | Could |
| US-07.5 | En tant que gérant, je veux segmenter mes clients (VIP, dormant) | Could |

### EPIC-08 — Finance & Comptabilité
| ID | User Story | Priorité |
|----|-----------|----------|
| US-08.1 | En tant que comptable, je veux enregistrer les dépenses | Must |
| US-08.2 | En tant que gérant, je veux voir recettes, dépenses et résultat net | Must |
| US-08.3 | En tant que comptable, je veux exporter un rapport financier PDF/Excel | Should |
| US-08.4 | En tant que comptable, je veux rapprocher la caisse en fin de journée | Should |
| US-08.5 | En tant que gérant, je veux un journal comptable simplifié automatique | Could |

### EPIC-09 — Tableau de Bord & Rapports
| ID | User Story | Priorité |
|----|-----------|----------|
| US-09.1 | En tant que gérant, je veux voir le CA du jour/mois/année | Must |
| US-09.2 | En tant que gérant, je veux voir les produits les plus vendus | Must |
| US-09.3 | En tant que gérant, je veux voir les produits en rupture | Must |
| US-09.4 | En tant que gérant, je veux des graphiques de ventes | Should |
| US-09.5 | En tant que gérant, je veux exporter des rapports PDF/Excel | Should |

### EPIC-10 — Notifications
| ID | User Story | Priorité |
|----|-----------|----------|
| US-10.1 | En tant qu'utilisateur, je veux recevoir des alertes stock faible | Must |
| US-10.2 | En tant que gérant, je veux être notifié des paiements en retard | Should |
| US-10.3 | En tant qu'admin, je veux configurer des règles de notification | Could |

### EPIC-11 — SaaS & Abonnements
| ID | User Story | Priorité |
|----|-----------|----------|
| US-11.1 | En tant que super admin, je veux créer des plans d'abonnement | Should |
| US-11.2 | En tant qu'entreprise, je veux souscrire à un plan mensuel | Should |
| US-11.3 | En tant que super admin, je veux suspendre une entreprise impayée | Should |
| US-11.4 | En tant qu'entreprise, je veux voir ma facture SaaS | Could |

### EPIC-12 — Mode Hors Ligne
| ID | User Story | Priorité |
|----|-----------|----------|
| US-12.1 | En tant que caissier, je veux vendre sans connexion internet | Must |
| US-12.2 | En tant qu'utilisateur, je veux voir le statut de synchronisation | Must |
| US-12.3 | En tant que système, je veux résoudre les conflits de sync automatiquement | Should |

### EPIC-13 — RH & Employés
| ID | User Story | Priorité |
|----|-----------|----------|
| US-13.1 | En tant qu'admin, je veux gérer les fiches employés | Should |
| US-13.2 | En tant qu'admin, je veux enregistrer les présences | Could |
| US-13.3 | En tant qu'admin, je veux gérer les salaires | Could |

### EPIC-14 — Évolutions Futures
| ID | User Story | Priorité |
|----|-----------|----------|
| US-14.1 | Prévision de stock par IA | Won't (V1) |
| US-14.2 | OCR lecture factures fournisseurs | Won't (V1) |
| US-14.3 | Intégration Wave / Orange Money / MTN | Could |
| US-14.4 | Application web complète | Won't (V1) |
| US-14.5 | API publique partenaires | Could |
