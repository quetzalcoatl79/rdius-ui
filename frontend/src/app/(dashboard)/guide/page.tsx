'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Radio,
  Users,
  Users2,
  Server,
  Shield,
  FileText,
  RefreshCw,
  Network,
  Key,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';

interface Section {
  id: string;
  icon: typeof BookOpen;
  titleFr: string;
  titleEn: string;
  contentFr: string[];
  contentEn: string[];
}

const sections: Section[] = [
  {
    id: 'what-is-radius',
    icon: Radio,
    titleFr: "Qu'est-ce que RADIUS ?",
    titleEn: 'What is RADIUS?',
    contentFr: [
      "RADIUS (Remote Authentication Dial-In User Service) est un protocole réseau qui gère l'authentification, l'autorisation et la comptabilité (AAA) des utilisateurs qui se connectent à un réseau.",
      "Quand un utilisateur se connecte au WiFi, au VPN ou à un switch, l'équipement réseau (NAS) envoie une requête au serveur RADIUS pour vérifier les identifiants.",
      "FreeRADIUS est l'implémentation open source la plus utilisée de ce protocole. Radius UI vous permet de le configurer entièrement via cette interface web.",
    ],
    contentEn: [
      'RADIUS (Remote Authentication Dial-In User Service) is a network protocol that manages authentication, authorization, and accounting (AAA) for users connecting to a network.',
      'When a user connects to WiFi, VPN, or a network switch, the network device (NAS) sends a request to the RADIUS server to verify credentials.',
      'FreeRADIUS is the most widely used open source implementation of this protocol. Radius UI lets you fully configure it through this web interface.',
    ],
  },
  {
    id: 'flow',
    icon: Network,
    titleFr: 'Comment fonctionne le flux ?',
    titleEn: 'How does the flow work?',
    contentFr: [
      "1. L'utilisateur tente de se connecter (WiFi, VPN, 802.1X...)",
      "2. L'équipement réseau (NAS) envoie une requête Access-Request au serveur FreeRADIUS",
      "3. FreeRADIUS vérifie les identifiants dans la base de données (gérée par Radius UI)",
      "4. Si OK → Access-Accept (connexion autorisée) avec les attributs de réponse (VLAN, débit, etc.)",
      "5. Si KO → Access-Reject (connexion refusée)",
      "6. Pendant la session, le NAS envoie des paquets Accounting pour tracer la consommation",
    ],
    contentEn: [
      '1. User attempts to connect (WiFi, VPN, 802.1X...)',
      '2. Network equipment (NAS) sends an Access-Request to the FreeRADIUS server',
      '3. FreeRADIUS checks credentials in the database (managed by Radius UI)',
      '4. If OK → Access-Accept (connection allowed) with reply attributes (VLAN, bandwidth, etc.)',
      '5. If KO → Access-Reject (connection denied)',
      '6. During the session, the NAS sends Accounting packets to track usage',
    ],
  },
  {
    id: 'users',
    icon: Users,
    titleFr: 'Utilisateurs RADIUS',
    titleEn: 'RADIUS Users',
    contentFr: [
      "Les utilisateurs RADIUS sont les comptes qui peuvent s'authentifier sur le réseau. Chaque utilisateur a :",
      "• Un nom d'utilisateur (username) — identifiant unique",
      "• Un mot de passe — stocké de manière sécurisée dans la base",
      "• Des attributs de vérification (check) — conditions à remplir pour autoriser l'accès",
      "• Des attributs de réponse (reply) — paramètres renvoyés au NAS (VLAN, débit, timeout...)",
      "Vous pouvez créer, modifier, désactiver et supprimer des utilisateurs depuis la page Utilisateurs.",
    ],
    contentEn: [
      'RADIUS users are accounts that can authenticate on the network. Each user has:',
      '• A username — unique identifier',
      '• A password — securely stored in the database',
      '• Check attributes — conditions that must be met to allow access',
      '• Reply attributes — parameters sent back to the NAS (VLAN, bandwidth, timeout...)',
      'You can create, edit, disable, and delete users from the Users page.',
    ],
  },
  {
    id: 'groups',
    icon: Users2,
    titleFr: 'Groupes',
    titleEn: 'Groups',
    contentFr: [
      "Les groupes permettent d'appliquer des attributs communs à plusieurs utilisateurs sans les dupliquer.",
      "Par exemple, un groupe 'WiFi-Standard' peut définir un VLAN et un débit max, appliqués automatiquement à tous ses membres.",
      "Un utilisateur peut appartenir à plusieurs groupes avec des priorités différentes. Les attributs sont fusionnés selon la priorité.",
      "Gérez les groupes et leurs membres depuis la page Groupes.",
    ],
    contentEn: [
      'Groups allow you to apply common attributes to multiple users without duplication.',
      "For example, a 'WiFi-Standard' group can define a VLAN and max bandwidth, automatically applied to all its members.",
      'A user can belong to multiple groups with different priorities. Attributes are merged based on priority.',
      'Manage groups and their members from the Groups page.',
    ],
  },
  {
    id: 'nas',
    icon: Server,
    titleFr: 'Équipements NAS',
    titleEn: 'NAS Equipment',
    contentFr: [
      "Un NAS (Network Access Server) est un équipement réseau qui communique avec FreeRADIUS : borne WiFi, switch, contrôleur VPN, etc.",
      "Chaque NAS doit être enregistré avec :",
      "• Son adresse IP — pour que FreeRADIUS accepte ses requêtes",
      "• Un nom court — pour l'identifier facilement dans les logs",
      "• Un secret partagé — mot de passe commun entre le NAS et FreeRADIUS (doit être identique des deux côtés)",
      "⚠️ Important : après ajout, modification ou suppression d'un NAS, FreeRADIUS doit être redémarré pour prendre en compte les changements. L'application le fait automatiquement.",
    ],
    contentEn: [
      'A NAS (Network Access Server) is a network device that communicates with FreeRADIUS: WiFi access point, switch, VPN controller, etc.',
      'Each NAS must be registered with:',
      '• Its IP address — so FreeRADIUS accepts its requests',
      '• A short name — for easy identification in logs',
      '• A shared secret — common password between NAS and FreeRADIUS (must be identical on both sides)',
      '⚠️ Important: after adding, modifying, or deleting a NAS, FreeRADIUS must be restarted to apply changes. The application does this automatically.',
    ],
  },
  {
    id: 'servers',
    icon: RefreshCw,
    titleFr: 'Serveurs FreeRADIUS',
    titleEn: 'FreeRADIUS Servers',
    contentFr: [
      "Radius UI peut gérer plusieurs serveurs FreeRADIUS simultanément. Deux modes sont disponibles :",
      "🐳 Docker — Le serveur FreeRADIUS tourne dans un conteneur Docker géré par cette application. Vous pouvez le redémarrer, voir son statut et sa consommation CPU/mémoire directement.",
      "🌐 Distant (SSH) — Le serveur FreeRADIUS tourne sur une machine distante. Radius UI se connecte en SSH pour le redémarrer et vérifier son statut. Idéal pour les serveurs en production.",
      "Vous pouvez ajouter autant de serveurs que nécessaire depuis la page Serveurs.",
    ],
    contentEn: [
      'Radius UI can manage multiple FreeRADIUS servers simultaneously. Two modes are available:',
      '🐳 Docker — The FreeRADIUS server runs in a Docker container managed by this application. You can restart it, see its status and CPU/memory usage directly.',
      '🌐 Remote (SSH) — The FreeRADIUS server runs on a remote machine. Radius UI connects via SSH to restart it and check its status. Ideal for production servers.',
      'You can add as many servers as needed from the Servers page.',
    ],
  },
  {
    id: 'attributes',
    icon: Key,
    titleFr: 'Attributs RADIUS',
    titleEn: 'RADIUS Attributes',
    contentFr: [
      "Les attributs sont les paramètres qui contrôlent l'authentification et l'autorisation. Il y a deux types :",
      "Attributs de vérification (check) — Conditions vérifiées AVANT d'autoriser l'accès :",
      "• Cleartext-Password := 'motdepasse' — Mot de passe en clair",
      "• Simultaneous-Use := 1 — Nombre max de sessions simultanées",
      "• Auth-Type := Reject — Bloquer un utilisateur",
      "Attributs de réponse (reply) — Paramètres envoyés au NAS SI l'accès est autorisé :",
      "• Tunnel-Private-Group-Id := '100' — Assigner le VLAN 100",
      "• Session-Timeout := 3600 — Déconnecter après 1 heure",
      "• WISPr-Bandwidth-Max-Down := 10000000 — Limiter le débit descendant",
      "L'opérateur := signifie 'assigner', == signifie 'vérifier si égal'.",
    ],
    contentEn: [
      'Attributes are parameters that control authentication and authorization. There are two types:',
      'Check attributes — Conditions verified BEFORE granting access:',
      "• Cleartext-Password := 'password' — Plaintext password",
      '• Simultaneous-Use := 1 — Max simultaneous sessions',
      '• Auth-Type := Reject — Block a user',
      'Reply attributes — Parameters sent to the NAS IF access is granted:',
      "• Tunnel-Private-Group-Id := '100' — Assign VLAN 100",
      '• Session-Timeout := 3600 — Disconnect after 1 hour',
      '• WISPr-Bandwidth-Max-Down := 10000000 — Limit download bandwidth',
      "The := operator means 'assign', == means 'check if equal'.",
    ],
  },
  {
    id: 'logs',
    icon: FileText,
    titleFr: 'Journaux et monitoring',
    titleEn: 'Logs and monitoring',
    contentFr: [
      "Radius UI propose trois types de journaux :",
      "📊 Comptabilité (Accounting) — Historique complet des sessions : qui s'est connecté, quand, combien de données consommées, pourquoi déconnecté.",
      "🔐 Authentification (PostAuth) — Chaque tentative d'authentification avec le résultat (Accept/Reject). Utile pour diagnostiquer les problèmes de connexion.",
      "🟢 Sessions actives — Vue temps réel des utilisateurs actuellement connectés avec leur consommation en cours.",
      "Le tableau de bord résume tout avec des graphiques de taux d'authentification, trafic par NAS et top utilisateurs.",
    ],
    contentEn: [
      'Radius UI offers three types of logs:',
      '📊 Accounting — Complete session history: who connected, when, how much data consumed, why disconnected.',
      '🔐 Authentication (PostAuth) — Every authentication attempt with result (Accept/Reject). Useful for diagnosing connection issues.',
      '🟢 Active Sessions — Real-time view of currently connected users with their ongoing consumption.',
      'The dashboard summarizes everything with authentication rate charts, traffic per NAS, and top users.',
    ],
  },
  {
    id: 'security',
    icon: Shield,
    titleFr: 'Sécurité et rôles',
    titleEn: 'Security and roles',
    contentFr: [
      "L'accès à Radius UI est contrôlé par un système de rôles :",
      "👑 Super Admin — Accès total, peut gérer les utilisateurs de l'application et les serveurs",
      "🔧 Admin — Peut gérer les utilisateurs RADIUS, groupes, NAS et voir les logs",
      "📋 Opérateur — Peut créer/modifier des utilisateurs et groupes, mais pas supprimer",
      "👁️ Lecteur — Lecture seule sur tout, ne peut rien modifier",
      "Toutes les actions sont tracées dans le journal d'audit (qui a fait quoi, quand, depuis quelle IP).",
    ],
    contentEn: [
      'Access to Radius UI is controlled by a role system:',
      '👑 Super Admin — Full access, can manage application users and servers',
      '🔧 Admin — Can manage RADIUS users, groups, NAS, and view logs',
      '📋 Operator — Can create/edit users and groups, but not delete',
      '👁️ Viewer — Read-only access to everything',
      'All actions are tracked in the audit log (who did what, when, from which IP).',
    ],
  },
  {
    id: 'quickstart',
    icon: CheckCircle,
    titleFr: 'Démarrage rapide',
    titleEn: 'Quick start',
    contentFr: [
      "Pour configurer votre premier réseau RADIUS avec cette interface :",
      "1️⃣ Serveurs — Vérifiez que votre serveur FreeRADIUS est bien enregistré et actif dans la page Serveurs",
      "2️⃣ NAS — Ajoutez vos équipements réseau (bornes WiFi, switches) avec leur IP et un secret partagé",
      "3️⃣ Groupes — Créez des groupes avec les attributs communs (VLAN, débit, etc.)",
      "4️⃣ Utilisateurs — Créez les comptes utilisateurs et assignez-les aux groupes",
      "5️⃣ Test — Essayez de vous connecter avec un compte test depuis un équipement enregistré",
      "6️⃣ Monitoring — Surveillez les connexions dans le tableau de bord et les journaux",
      "💡 Astuce : configurez d'abord le NAS côté équipement réseau avec la même IP et le même secret partagé que dans Radius UI.",
    ],
    contentEn: [
      'To set up your first RADIUS network with this interface:',
      '1️⃣ Servers — Verify your FreeRADIUS server is registered and active on the Servers page',
      '2️⃣ NAS — Add your network devices (WiFi APs, switches) with their IP and a shared secret',
      '3️⃣ Groups — Create groups with common attributes (VLAN, bandwidth, etc.)',
      '4️⃣ Users — Create user accounts and assign them to groups',
      '5️⃣ Test — Try connecting with a test account from a registered device',
      '6️⃣ Monitoring — Monitor connections on the dashboard and logs',
      '💡 Tip: first configure the NAS on the network device side with the same IP and shared secret as in Radius UI.',
    ],
  },
];

export default function GuidePage() {
  const { locale } = useI18n();
  const [activeSection, setActiveSection] = useState('quickstart');

  const currentSection = sections.find((s) => s.id === activeSection) ?? sections[0];

  return (
    <div className="flex gap-6 max-w-5xl">
      {/* Left nav */}
      <nav className="w-56 shrink-0 space-y-1 sticky top-6 self-start hidden lg:block">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-3">
          {locale === 'fr' ? 'Sommaire' : 'Contents'}
        </h2>
        {sections.map((section) => {
          const Icon = section.icon;
          const title = locale === 'fr' ? section.titleFr : section.titleEn;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{title}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            {locale === 'fr' ? 'Guide utilisateur' : 'User Guide'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === 'fr'
              ? 'Tout ce que vous devez savoir pour utiliser Radius UI'
              : 'Everything you need to know to use Radius UI'}
          </p>
        </div>

        {/* Mobile section selector */}
        <div className="lg:hidden mb-4">
          <select
            value={activeSection}
            onChange={(e) => setActiveSection(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {locale === 'fr' ? s.titleFr : s.titleEn}
              </option>
            ))}
          </select>
        </div>

        {/* Active section content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <currentSection.icon className="h-5 w-5 text-primary" />
              {locale === 'fr' ? currentSection.titleFr : currentSection.titleEn}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(locale === 'fr' ? currentSection.contentFr : currentSection.contentEn).map(
                (paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed text-foreground/90">
                    {paragraph}
                  </p>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation between sections */}
        <div className="flex justify-between mt-4">
          {sections.indexOf(currentSection) > 0 ? (
            <button
              onClick={() =>
                setActiveSection(sections[sections.indexOf(currentSection) - 1].id)
              }
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              {locale === 'fr'
                ? sections[sections.indexOf(currentSection) - 1].titleFr
                : sections[sections.indexOf(currentSection) - 1].titleEn}
            </button>
          ) : (
            <div />
          )}
          {sections.indexOf(currentSection) < sections.length - 1 ? (
            <button
              onClick={() =>
                setActiveSection(sections[sections.indexOf(currentSection) + 1].id)
              }
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {locale === 'fr'
                ? sections[sections.indexOf(currentSection) + 1].titleFr
                : sections[sections.indexOf(currentSection) + 1].titleEn}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
