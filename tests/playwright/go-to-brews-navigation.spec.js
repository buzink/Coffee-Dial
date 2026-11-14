import { test, expect } from '@playwright/test';

const openMenuItem = async (page, itemSelector) => {
    await page.locator('#mainMenuBtn').click();
    await expect(page.locator('#mainMenuDropdown')).toBeVisible();
    await page.locator(itemSelector).click();
};

const assertNavigatedToBrews = async (page, sourcePageSelector) => {
    await expect(page.locator(sourcePageSelector)).toBeHidden();
    // Pages replace each other: back on brews, no page key left in the URL.
    await expect(page.locator('#signedInContent')).toBeVisible();
    await expect(page).not.toHaveURL(/[?&](beans|coffees|gear|statistics)(&|$)/);
    await page.waitForFunction(() => {
        const activeFiltersContainer = document.getElementById('activeFiltersContainer');
        const activeFiltersList = document.getElementById('activeFiltersList');
        if (!activeFiltersContainer || !activeFiltersList) return false;
        const hasVisibleContainer = !activeFiltersContainer.classList.contains('hidden');
        const hasAnyFilterChip = activeFiltersList.children.length > 0;
        return hasVisibleContainer && hasAnyFilterChip;
    });
};

const assertNavigatedToBeans = async (page, sourcePageSelector) => {
    await expect(page.locator(sourcePageSelector)).toBeHidden();
    await expect(page.locator('#beansPage')).toBeVisible();
    await expect(page.locator('#signedInContent')).toBeHidden();
    await expect(page).toHaveURL(/[?&]beans(&|$)/);
    await expect(page).not.toHaveURL(/[?&]coffees(&|$)/);
    await expect(page.locator('#beansTableBody tr[data-id]').first()).toBeVisible();
};

test('go to brews/go to beans table actions close menu+modal and navigate', async ({ page }) => {
    await page.goto('/index.html?smoke=1&e2eSeed=1');

    await page.waitForFunction(
        () => {
            const report = window.__coffeeDialSmokeReport;
            return !!report && report.commandFlows?.status !== 'pending';
        },
        null,
        { timeout: 30_000 }
    );

    await openMenuItem(page, '#menuBeansBtn');
    const beanRow = page.locator('#beansTableBody tr[data-id]').first();
    await expect(beanRow).toBeVisible();
    await beanRow.locator('button[data-action-click^="beansToggleActionMenu"]').click();
    const beanMenu = beanRow.locator('.action-menu').first();
    await expect(beanMenu).toBeVisible();
    await beanMenu.getByRole('button', { name: 'Go to brews' }).click();
    await assertNavigatedToBrews(page, '#beansPage');

    await openMenuItem(page, '#menuCoffeesBtn');
    const coffeeRow = page.locator('#coffeeTypesTableBody tr[data-id]').first();
    await expect(coffeeRow).toBeVisible();
    await coffeeRow.locator('button[data-action-click^="coffeesToggleActionMenu"]').click();
    const coffeeMenu = coffeeRow.locator('.action-menu').first();
    await expect(coffeeMenu).toBeVisible();
    await coffeeMenu.getByRole('button', { name: 'Go to brews' }).click();
    await assertNavigatedToBrews(page, '#coffeeTypesPage');

    await openMenuItem(page, '#menuGasBtn');
    const gasRow = page.locator('#gasTableBody tr[data-id]').first();
    await expect(gasRow).toBeVisible();
    await gasRow.locator('button[data-action-click^="gasToggleActionMenu"]').click();
    const gasMenu = gasRow.locator('.action-menu').first();
    await expect(gasMenu).toBeVisible();
    await gasMenu.getByRole('button', { name: 'Go to brews' }).click({ force: true });
    await assertNavigatedToBrews(page, '#gasPage');

    await openMenuItem(page, '#menuCoffeesBtn');
    const coffeeRowForBeans = page.locator('#coffeeTypesTableBody tr[data-id]').first();
    await expect(coffeeRowForBeans).toBeVisible();
    await coffeeRowForBeans.locator('button[data-action-click^="coffeesToggleActionMenu"]').click();
    const coffeeMenuForBeans = coffeeRowForBeans.locator('.action-menu').first();
    await expect(coffeeMenuForBeans).toBeVisible();
    await coffeeMenuForBeans.getByRole('button', { name: 'Go to bags' }).click();
    await assertNavigatedToBeans(page, '#coffeeTypesPage');
});
