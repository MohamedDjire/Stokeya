# Guide vendeur — Boutique en ligne Stokeya

Ce document décrit le fonctionnement complet de la boutique en ligne B2B/grossiste d’Stokeya : ce que voit le client, ce que fait le vendeur, et comment chaque écran s’articule avec le stock, les ventes et le tableau de bord.

---

## 1. Vue d’ensemble

Stokeya propose **une boutique en ligne par entreprise**, liée à la **boutique principale** (siège). Les clients commandent depuis un lien public ; le vendeur traite les commandes dans l’application Stokeya.

| Acteur | Interface | URL type |
|--------|-----------|----------|
| **Client** | Boutique publique | `/shop/mon-slug` ou `/s/CODE123` |
| **Vendeur** | Application Stokeya (connecté) | `/sites`, `/orders`, etc. |

**Principe clé :** une commande boutique n’est **pas** une vente immédiate. Le stock n’est **réservé qu’à la préparation** et **sorti à la livraison**. La **vente** (CA, historique, dashboard) est créée automatiquement quand la commande passe en **Livrée**.

---

## 2. Parcours client (boutique publique)

### 2.1 Page d’accueil — En-tête et confiance

- **Bannière / logo / nom** : identité de la boutique (configurée dans *Sites & boutique*).
- **Bandeau de confiance** : livraison ou retrait, commande sécurisée, support WhatsApp.
- **Barre de recherche** (onglet Catalogue) : recherche par nom, référence ou code-barres.
- **Panier** : accessible en haut à droite ; barre fixe en bas sur mobile.

### 2.2 Onglet « Catalogue »

**Rôle :** parcourir et commander article par article (comportement e-commerce classique).

| Action client | Effet |
|---------------|-------|
| Filtrer par catégorie | Affiche les produits de la catégorie |
| Choisir une quantité | Quantité ajoutée au panier |
| **Ajouter** | Produit ajouté au panier |
| Ouvrir le panier | Voir lignes, HT, TVA, total TTC |
| **Commander** | Ouvre le formulaire de finalisation |

**Informations affichées (selon réglages vendeur) :**
- Prix unitaire (prix gros automatique à partir de 10 unités si `wholesale_price` défini)
- Stock disponible
- Badge « Rupture » / « Stock limité »

### 2.3 Onglet « Commande rapide »

**Rôle :** commande B2B optimisée pour grossistes et revendeurs habitués aux références.

| Étape | Action |
|-------|--------|
| 1 | Saisir **référence SKU** ou **code-barres** (+ quantité) |
| 2 | Appuyer sur **Entrée** ou **Ajouter** |
| 3 | Répéter pour tous les articles |
| 4 | Vérifier le **récapitulatif** (colonne droite) |
| 5 | **Passer la commande** |

**Avantages :**
- Pas besoin de parcourir le catalogue
- Compatible scanner (saisie clavier = scan)
- Prix de gros appliqué automatiquement (≥ 10 unités)

### 2.4 Onglet « Suivi »

**Rôle :** permettre au client de suivre sa commande sans se connecter.

| Champ | Description |
|-------|-------------|
| Numéro de commande | Ex. `CMD-20260717-0001` (fourni à la confirmation) |
| Téléphone | Même numéro qu’à la commande |

**Affichage :**
- **Stepper visuel** : Reçue → Validée → Préparation → Prête → Livrée → Terminée
- Détail : total, mode de paiement, statut paiement, lignes articles

### 2.5 Finalisation de commande (checkout)

| Champ | Obligatoire |
|-------|-------------|
| Nom / société | Oui |
| Téléphone | Oui |
| Ville | Non |
| Livraison ou retrait | Oui |
| Adresse | Oui si livraison |
| Mode de paiement | Selon réglages vendeur |
| Référence paiement | Oui si Wave/OM et paiement avant livraison |
| Note | Non |

**Modes de paiement possibles :**
- **À la livraison (COD)** : le client paie le livreur
- **Wave** : paiement direct sur le numéro Wave du vendeur
- **Orange Money** : paiement direct sur le numéro OM du vendeur

Après validation, le client reçoit un **numéro de commande** à conserver pour le suivi.

---

## 3. Parcours vendeur — Configuration

### 3.1 Inscription (`/register`)

Lors de la création du compte, le vendeur peut renseigner dès le départ :

| Champ | Utilité |
|-------|---------|
| Nom entreprise, adresse, ville | Fiche boutique |
| WhatsApp / téléphone | Contact clients |
| Slug boutique | Lien public personnalisé |
| Numéros Wave / Orange Money | Paiements mobiles |
| Moment du paiement | À la livraison / avant / les deux |

→ Une **OnlineShop** est créée automatiquement avec ces informations.

### 3.2 Sites & boutique (`/sites` — onglet « Boutique en ligne »)

**Rôle :** personnaliser l’apparence et les règles commerciales de la boutique publique.

| Section | Paramètres | Effet |
|---------|------------|-------|
| **Lien** | URL permanente + lien court | Partage WhatsApp, réseaux |
| **Activation** | Boutique activée / désactivée | Accès public on/off |
| **Identité** | Nom, description, couleurs, logo, bannière | Design boutique |
| **Contact** | Téléphone, WhatsApp, adresse, horaires | En-tête et pied de page |
| **Catalogue** | Afficher prix / stock | Visibilité côté client |
| **Paiement** | Wave, OM, timing, modes acceptés | Options au checkout |

**Actions vendeur :**
- **Copier le lien** → envoyer aux clients
- **WhatsApp** → partage pré-rempli
- **Enregistrer la boutique** → applique les modifications

### 3.3 Produits (`/products`)

Pour qu’un produit apparaisse en boutique :

| Condition | Détail |
|-----------|--------|
| `is_active = true` | Produit actif |
| Stock > 0 (entrepôt POS boutique principale) | Disponibilité |
| Prix de vente renseigné | Affichage prix |
| `wholesale_price` (optionnel) | Prix gros dès 10 unités |
| Image (recommandé) | Meilleure présentation catalogue |

### 3.4 Stock (`/stock`, entrepôts dans `/sites`)

- La boutique utilise l’entrepôt **POS** de la **boutique principale** (`is_pos_stock`).
- Le stock affiché = quantité **disponible** (total − réservations).

---

## 4. Parcours vendeur — Traitement des commandes

### 4.1 Commandes boutique (`/orders`)

**Rôle :** liste et traitement de toutes les commandes reçues depuis la boutique en ligne.

| Colonne | Signification |
|---------|---------------|
| Date | Date de création |
| N° commande | Référence unique (`CMD-…`) |
| Client | Nom + téléphone |
| Total | Montant TTC |
| Paiement | Statut : Non payé / En attente / Payé |
| Statut | Étape du cycle commande |

**Clic sur une ligne** → détail complet avec actions.

### 4.2 Cycle de vie d’une commande

```
En attente → Validée → Préparation → Prête → Livrée → Terminée
                ↘ Annulée (à tout moment avant livraison)
```

| Statut | Action vendeur | Effet stock | Effet vente |
|--------|----------------|-------------|-------------|
| **En attente** | Nouvelle commande client | Aucun | Aucun |
| **Validée** | Confirmer la commande | Aucun | Aucun |
| **Préparation** | Commencer le picking | **Réservation** stock | Aucun |
| **Prête** | Commande emballée | Réservation maintenue | Aucun |
| **Livrée** | Remise au client / livreur | **Sortie** stock définitive | **Création vente** + CA dashboard |
| **Terminée** | Clôture administrative | — | Vente déjà comptabilisée |
| **Annulée** | Refus / annulation | Libération réservation si existait | Aucune vente |

### 4.3 Actions dans le détail commande

| Bouton / action | Quand l’utiliser |
|-----------------|------------------|
| **Valider** | Commande reçue, vous acceptez de la traiter |
| **Préparation** | Vous commencez à préparer (réserve le stock) |
| **Prête** | Commande prête pour livraison ou retrait |
| **Livrée** | Client a reçu la marchandise |
| **Terminée** | Clôture après livraison |
| **Confirmer le paiement** | Client a payé par Wave/OM (obligatoire avant livraison si « paiement avant livraison ») |
| **Picking list** | Liste de préparation par emplacement |
| **Bon de commande / Facture / BL** | Impression documents |
| **Ajuster quantités** | Modifier lignes (statuts early only) |

### 4.4 Paiements Wave / Orange Money

| Réglage vendeur | Comportement |
|-----------------|--------------|
| **À la livraison** | Client choisit COD ou mobile ; paiement mobile = statut « En attente » jusqu’à confirmation vendeur |
| **Avant livraison** | Client doit payer avant ; référence transaction demandée ; **livraison bloquée** tant que paiement non confirmé |
| **Les deux** | Client choisit au checkout |

**Action vendeur « Confirmer le paiement » :**
1. Vérifier réception sur Wave/OM
2. Cliquer **Confirmer le paiement**
3. Si commande déjà livrée → vente marquée payée
4. Si pas encore livrée → débloque le passage en **Livrée**

---

## 5. Lien avec les autres modules

### 5.1 Historique des ventes (`/sales`)

Les commandes boutique **livrées** apparaissent comme ventes avec :
- Référence vente `VTE-…`
- Lien interne `client_reference = shop-{id}`
- Notes : « Commande boutique CMD-… »
- Paiement mappé : COD → Espèces, Wave/OM → Mobile Money

### 5.2 Tableau de bord (`/`)

Le **CA du jour / du mois** inclut ces ventes (statut `completed`, payé ou non selon mode).

### 5.3 Clients (`/customers`)

À chaque commande, le client est **créé ou mis à jour** (téléphone = clé) :
- Nom, adresse, ville
- Points fidélité à la **livraison**
- Historique commandes dans la fiche 360°

### 5.4 Stock

| Moment | Mouvement |
|--------|-----------|
| Commande créée | Vérification disponibilité uniquement |
| → Préparation | Réservation (`reserved_quantity`) |
| → Livrée | Sortie stock (`movement_type = SALE`) |
| → Annulée | Libération réservation |

**Important :** pas de double sortie — la vente boutique ne repasse pas par le POS.

---

## 6. Récapitulatif des pages vendeur

| Page | Route | Rôle principal |
|------|-------|----------------|
| **Tableau de bord** | `/` | CA, alertes stock, vue globale |
| **Produits** | `/products` | Catalogue, prix, prix gros, images |
| **Stock** | `/stock` | Niveaux, mouvements, alertes |
| **Sites & boutique** | `/sites` | PDV, entrepôts, **config boutique en ligne** |
| **Commandes boutique** | `/orders` | **Traitement commandes web** |
| **Ventes** | `/sales` | Historique incluant ventes boutique |
| **Clients** | `/customers` | Fiches clients créées par la boutique |
| **Caisse (POS)** | `/pos` | Ventes magasin (distinct de la boutique) |
| **Rapports** | `/reports` | Analyses CA, modes de paiement |

---

## 7. Bonnes pratiques vendeur

1. **Configurer Wave/OM** avant de partager le lien boutique.
2. **Activer l’affichage stock** pour éviter les commandes impossibles.
3. **Passer en Préparation** dès que vous commencez le picking (réserve le stock).
4. **Confirmer les paiements mobiles** avant livraison si mode « avant livraison ».
5. **Marquer Livrée** uniquement quand le client a bien reçu — c’est ce déclencheur qui comptabilise la vente.
6. **Partager le lien court** (`/s/CODE`) sur WhatsApp Status / groupes clients.
7. **Utiliser la commande rapide** pour vos clients grossistes (formation : référence + quantité).

---

## 8. FAQ

**Pourquoi ma commande n’apparaît pas dans les ventes ?**  
→ Tant qu’elle n’est pas **Livrée**, ce n’est pas une vente. Vérifiez le statut dans `/orders`.

**Le client a payé Wave mais la commande est bloquée en livraison ?**  
→ Cliquez **Confirmer le paiement** dans le détail commande.

**Puis-je modifier une commande après coup ?**  
→ Oui, les quantités tant que le statut est En attente / Validée / Préparation.

**Deux commandes pour le même stock ?**  
→ À la préparation, si stock insuffisant, le système refuse la transition.

**Différence POS vs boutique ?**  
→ POS = vente immédiate en magasin. Boutique = commande avec cycle et livraison.

---

## 9. Schéma synthétique

```
CLIENT (boutique publique)
    │
    ├─ Catalogue / Commande rapide
    ├─ Panier → Checkout (COD / Wave / OM)
    └─ Suivi commande
            │
            ▼
VENDEUR (/orders)
    │
    ├─ Valider → Préparer [réserve stock]
    ├─ Confirmer paiement [si Wave/OM]
    ├─ Livrer [sort stock + crée VENTE + CA dashboard]
    └─ Terminer
            │
            ▼
INVENTRA
    ├─ /sales (historique)
    ├─ / (dashboard CA)
    ├─ /customers (CRM)
    └─ /stock (mouvements)
```

---

*Document Stokeya — Boutique en ligne B2B — Dernière mise à jour : juillet 2026*
