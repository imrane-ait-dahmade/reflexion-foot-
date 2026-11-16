# User Personas

Legend: **Confirmed** = evidenced in current product · **Proposed** = v2 product target, not implemented as a distinct role/entity yet.

---

## 1. Independent Coach — **Confirmed**

### Objectives
- Run a short cognitive–visual session with a group of players.  
- See how each player looks and decides, without turning the session into an exam.  
- Share or keep a clear report (manual reading + optional AI).

### Responsibilities
- Create and close/archive sessions.  
- Choose which exercises to include.  
- Share the join code.  
- Interpret results and act on the pitch.

### Permissions (current)
- Register/login via Better Auth.  
- CRUD-ish over **own** sessions (create, list, close, archive).  
- View results for players in own sessions.  
- Trigger AI reports for own sessions/players.  
- Export PDF of reports.

### Main activities
1. Sign up / sign in.  
2. Create session → copy code.  
3. Open live dashboard.  
4. Expand a finished player → read indicators → generate AI report.  
5. Optionally generate group report + PDF.

### Problems they need to solve
- Limited time with many players.  
- Need comparable attempts (one try).  
- Need language flexibility (FR/AR reports).  
- Need something printable for staff meetings.

---

## 2. Player — **Confirmed** (session guest, not account holder)

### Objectives
- Join quickly and complete the assigned path without confusion.  
- Stay focused on looking/deciding, not on scores.

### Responsibilities
- Enter correct code and a unique display name.  
- Complete each exercise once, in the forced order.  
- Finish even if the session is about to close (grace window for submit exists server-side).

### Permissions (current)
- Join active (non-expired) sessions.  
- Play only assigned exercises, only next allowed slug.  
- **Cannot** see scores or AI reports in the player UI.

### Main activities
1. Open `/join`.  
2. Enter code + name.  
3. Auto-chain through exercises.  
4. See “Terminé” confirmation.

### Problems they need to solve
- Phone/tablet UX (zoom, touch).  
- Unclear instructions → mitigated by intros/demos in exercise UI.  
- Network flakiness at submit → grace period after close/expiry.

---

## 3. Academy Administrator — **Proposed** (not a distinct role today)

### Objectives (intended)
- Manage several coaches and teams under one academy.  
- Standardize which tests are used across age groups.  
- See academy-level reporting.

### Current reality
- No `organizations` table or academy admin UI.  
- A coach account is the only admin surface; “academy” is organizational in real life only.

### Suggested v2 responsibilities (if introduced)
- Invite coaches, define org settings, oversee teams/players directories, export org reports.

---

## 4. Club Administrator — **Proposed** (not distinct today)

### Objectives (intended)
- Same multi-coach governance as academy, possibly with club branding and multiple sites.

### Current reality
- Identical gap as academy: no tenant entity, no club role.

---

## Persona summary

| Persona | Status | Auth today |
|---------|--------|------------|
| Independent Coach | Confirmed | Better Auth |
| Player (guest) | Confirmed | Code + name |
| Academy Administrator | Proposed | — |
| Club Administrator | Proposed | — |
| Player with persistent account | Proposed (schema hint only: nullable `session_players.user_id`) | — |

## Open product decisions
1. Should academy/club admins be separate roles or permissions on an organization?  
2. Should players get optional accounts, or stay guests forever?  
3. Can one person be both coach and org admin?
