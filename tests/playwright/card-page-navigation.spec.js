import { test, expect } from '@playwright/test';

// A card of another type than the current page moves to that card's page:
// brews → brew card → "Go to coffee" shows the coffees page with the coffee card
// on top. The card's back button returns to brews with the brew card open again;
// there the back button just closes the brew card (it was opened on its own page).
// The X always just closes the card and stays on the page under it.
test('card of another type opens on its own page and Back restores the previous card', async ({ page }) => {
    await page.goto('/index.html?e2eSeed=1');

    const brewRow = page.locator('#brewsTableMount [data-action-click^="brewsOpenCard("]').first();
    await expect(brewRow).toBeAttached({ timeout: 30_000 });
    const brewId = (await brewRow.getAttribute('data-action-click')).match(/'([^']+)'/)[1];
    await page.evaluate((id) => window.__coffeeDialApp.actions.brewsOpenCard(id), brewId);

    const brewCard = page.locator('#coffeeCardOverlay');
    const coffeeCard = page.locator('#coffeeTypeCardOverlay');
    await expect(brewCard).toBeVisible();

    await page.locator('#coffeeCardMenuBtn').click();
    await page.locator('#coffeeCardActionMenu').getByRole('button', { name: 'Go to coffee' }).click();

    await expect(coffeeCard).toBeVisible();
    await expect(brewCard).toBeHidden();
    await expect(page.locator('#coffeeTypesPage')).toBeVisible();
    await expect(page).toHaveURL(/[?&]coffees(&|$)/);

    await coffeeCard.locator('[data-card-back]').click();
    await expect(page).not.toHaveURL(/[?&]coffees(&|$)/);
    await expect(page.locator('#coffeeTypesPage')).toBeHidden();
    await expect(page.locator('#signedInContent')).toBeVisible();
    await expect(brewCard).toBeVisible();
    await expect(coffeeCard).toBeHidden();

    await brewCard.locator('[data-card-back]').click();
    await expect(brewCard).toBeHidden();
    await expect(page.locator('#signedInContent')).toBeVisible();

    // The X closes the card and stays on the page under it (coffees), unlike Back.
    await page.evaluate((id) => window.__coffeeDialApp.actions.brewsOpenCard(id), brewId);
    await page.locator('#coffeeCardMenuBtn').click();
    await page.locator('#coffeeCardActionMenu').getByRole('button', { name: 'Go to coffee' }).click();
    await expect(coffeeCard).toBeVisible();
    await coffeeCard.locator('[data-card-close]').click();
    await expect(coffeeCard).toBeHidden();
    await expect(brewCard).toBeHidden();
    await expect(page.locator('#coffeeTypesPage')).toBeVisible();
    await expect(page).toHaveURL(/[?&]coffees(&|$)/);
});

// A chain of cross-links: brew → "Go to bag" → bag card → "Go to coffee" → coffee card.
// Back walks the chain in reverse: coffee → bag → brew, then closes the brew card.
test('back button walks back through a chain of cards: coffee → bag → brew', async ({ page }) => {
    await page.goto('/index.html?e2eSeed=1');

    const brewRow = page.locator('#brewsTableMount [data-action-click^="brewsOpenCard("]').first();
    await expect(brewRow).toBeAttached({ timeout: 30_000 });
    const brewId = (await brewRow.getAttribute('data-action-click')).match(/'([^']+)'/)[1];
    await page.evaluate((id) => window.__coffeeDialApp.actions.brewsOpenCard(id), brewId);

    const brewCard = page.locator('#coffeeCardOverlay');
    const bagCard = page.locator('#beanCardOverlay');
    const coffeeCard = page.locator('#coffeeTypeCardOverlay');
    await expect(brewCard).toBeVisible();

    await page.locator('#coffeeCardMenuBtn').click();
    await page.locator('#coffeeCardActionMenu').getByRole('button', { name: 'Go to bag' }).click();
    await expect(bagCard).toBeVisible();
    await expect(page.locator('#beansPage')).toBeVisible();

    await page.locator('#beanCardMenuBtn').click();
    await page.locator('#beanCardActionCoffee').click();
    await expect(coffeeCard).toBeVisible();
    await expect(page.locator('#coffeeTypesPage')).toBeVisible();

    await coffeeCard.locator('[data-card-back]').click();
    await expect(coffeeCard).toBeHidden();
    await expect(bagCard).toBeVisible();
    await expect(page.locator('#beansPage')).toBeVisible();

    await bagCard.locator('[data-card-back]').click();
    await expect(bagCard).toBeHidden();
    await expect(brewCard).toBeVisible();
    await expect(page.locator('#signedInContent')).toBeVisible();

    await brewCard.locator('[data-card-back]').click();
    await expect(brewCard).toBeHidden();
    await expect(page.locator('#signedInContent')).toBeVisible();
});
