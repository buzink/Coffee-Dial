import { analyzeBrewProfile } from '../../core/gemini-client.js';

// The AI profile card on the statistics page. A generated profile is saved per view
// ('mine' or a friend's uid) in users/{uid}/private/aiProfile, which only the owner can
// read (Firestore rules), and is shown again whenever that view is opened.

const GENERATE_LABEL = 'Generate AI Profile';
const REGENERATE_LABEL = 'Regenerate';

export const createStatsAiProfileModule = ({
    aiSettings,
    dataService,
    getCurrentStatsData,
    getCurrentUser
}) => {
    const { db, doc, getDoc, setDoc } = dataService || {};
    const profileRef = (uid) => doc(db, 'users', uid, 'private', 'aiProfile');
    let loadToken = 0;

    const getViewKey = () => document.getElementById('statsViewSelect')?.value || 'mine';

    const formatDate = (iso) => {
        const date = iso ? new Date(iso) : null;
        if (!date || Number.isNaN(date.getTime())) return '';
        return `Generated ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    };

    const renderProfile = (profile = null) => {
        const container = document.getElementById('aiProfileContainer');
        const textBox = document.getElementById('aiProfileText');
        const dateBox = document.getElementById('aiProfileDate');
        const label = document.getElementById('statsAIBtnLabel');
        const text = `${profile?.text || ''}`.trim();
        if (textBox) textBox.innerText = text;
        if (dateBox) dateBox.textContent = text ? formatDate(profile?.generatedAt) : '';
        container?.classList.toggle('hidden', !text);
        if (label) label.textContent = text ? REGENERATE_LABEL : GENERATE_LABEL;
    };

    // Show the saved profile of the view that is selected now (called when the page or view changes).
    const showSavedAIProfile = async () => {
        const token = ++loadToken;
        renderProfile(null);
        const uid = getCurrentUser()?.uid;
        if (!uid || !getDoc) return;
        const viewKey = getViewKey();
        try {
            const snap = await getDoc(profileRef(uid));
            if (token !== loadToken) return;
            const profiles = snap.exists() ? snap.data()?.profiles || {} : {};
            renderProfile(profiles[viewKey] || null);
        } catch (err) {
            console.warn('[Stats] Could not load the saved AI profile', err);
        }
    };

    const saveProfile = async (viewKey, profile) => {
        const uid = getCurrentUser()?.uid;
        if (!uid || !setDoc) return;
        try {
            await setDoc(profileRef(uid), { profiles: { [viewKey]: profile }, updatedAt: profile.generatedAt }, { merge: true });
        } catch (err) {
            console.error('[Stats] Could not save the AI profile', err);
        }
    };

    const triggerAIProfile = async () => {
        const currentStatsData = getCurrentStatsData();
        if (!currentStatsData.length) {
            alert('No brews found for this user to analyze.');
            return;
        }

        const btn = document.getElementById('statsAIBtn');
        const statsSelect = document.getElementById('statsViewSelect');
        if (!btn || !statsSelect) return;

        const originalContent = btn.innerHTML;
        const viewKey = getViewKey();
        let aiTargetName = statsSelect.options[statsSelect.selectedIndex]?.text || 'Home Brewer';
        if (viewKey === 'mine') {
            aiTargetName = getCurrentUser()?.displayName || 'Home Brewer';
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading brews...';
            btn.classList.add('ai-loading-pulse');

            const dataString = currentStatsData
                .slice(0, 100)
                .map(
                    (c) =>
                        `Roaster: ${c.coffee?.roaster || '-'}, Origin: ${c.coffee?.origin || '-'}, Farmer: ${c.coffee?.farmer || '-'}, Process: ${c.coffee?.processing || '-'}, Roast: ${c.coffee?.roastType || '-'}, Method: ${c.method || '-'}, Drink: ${c.drink || '-'}, Rating: ${c.rating || 0}/5, Notes: ${c.notes || 'None'}`
                )
                .join('\n');

            const { geminiApiKey, geminiModel } = await aiSettings.load();
            const text = await analyzeBrewProfile({
                apiKey: geminiApiKey,
                model: geminiModel,
                brewData: dataString,
                userName: aiTargetName
            });
            const profile = { text: `${text || ''}`.trim(), generatedAt: new Date().toISOString() };
            btn.innerHTML = originalContent;
            renderProfile(profile);
            await saveProfile(viewKey, profile);
        } catch (err) {
            console.error(err);
            btn.innerHTML = originalContent;
            alert(`Error generating profile: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.classList.remove('ai-loading-pulse');
        }
    };

    return {
        triggerAIProfile,
        showSavedAIProfile
    };
};
