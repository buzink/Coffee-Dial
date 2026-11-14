import { test, expect } from '@playwright/test';

// A card of another type than the current page moves to that card's page:
// brews → brew card → "Go to coffee" shows the coffees page with the coffee card
// on top. Closing the card stays on coffees; Back returns to brews with the brew
// card open again.
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

    await coffeeCard.locator('[data-action-click="closeCoffeeTypeCard(null)"]').click();
    await expect(coffeeCard).toBeHidden();
    await expect(page.locator('#coffeeTypesPage')).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/[?&]coffees(&|$)/);
    await expect(page.locator('#coffeeTypesPage')).toBeHidden();
    await expect(page.locator('#signedInContent')).toBeVisible();
    await expect(brewCard).toBeVisible();
    await expect(coffeeCard).toBeHidden();
});
