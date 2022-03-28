const dayjs = require("dayjs");
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin());

let page = null;
let browser;

const region = 15;
// 17 = Alingsås
// 15 = Göteborg
const MAX_DAYS_TO_WAIT = 52;

const FIRST_NAME = "Test";
const LAST_NAME = "Testsson";
const EMAIL = "testtestsson@hotmail.com";
const PHONE_NUMBER = "0712312312";

const UNAVAILABLE_DATES = [
    "2022-03-27",
    "2022-03-28",
]

const BOOK_PASS = true;
const BOOK_ID_CARD = false;

browser = puppeteer.launch({headless: false, channel: "chrome"})

    .then(async (browser) => {

        page = await browser.newPage();
        page.setViewport({
            width: 1200,
            height: 900,
            isMobile: false,
        });
        page.goto("https://bokapass.nemoq.se/Booking/Booking/Index/vastragotaland", {
            waitUntil: "networkidle2",
        });

        // Start
        await page.waitForTimeout(500);
        await page.waitForSelector('input[name="StartNextButton"]');
        await page.waitForTimeout(500);
        await page.click('input[name="StartNextButton"]');

        // Behandling av personuppgifter
        await page.waitForTimeout(500);
        await page.waitForSelector('input[name="AcceptInformationStorage"]');
        await page.click('input[name="AcceptInformationStorage"]'); // Jag har tagit del av ovan
        await page.click('input[name="Next"]');

        // Bor du i Sverige?
        await page.waitForTimeout(500);
        await page.waitForSelector('input[name="ServiceCategoryCustomers[0].ServiceCategoryId"]');
        await page.click('input[name="ServiceCategoryCustomers[0].ServiceCategoryId"]');
        await page.click('input[name="Next"]');

        // Välj tid
        await page.waitForSelector('select#SectionId');
        await page.select('select#SectionId', region.toString()) // Välj Passexpedition
        await retryFindTimes(page);
    })
    .catch((error) => {
        console.log(error)
    });

async function retryFindTimes(page) {
    await page.waitForSelector('input[name="TimeSearchFirstAvailableButton"]');
    await page.click('input[name="TimeSearchFirstAvailableButton"]'); // Första lediga tid
    await page.waitForTimeout(100);

    await page.waitForSelector('table.timetable');
    let dates = await page.evaluate(() => {
        let data = [];
        let elements = document.querySelectorAll('table.timetable thead th');
        for (var element of elements) {
            data.push(element.id);
        }
        return data;
    });

    const dateStrings = dates.filter((x) => x.length > 0);

    const maxDate = dayjs().add(MAX_DAYS_TO_WAIT, 'day');
    let wantedIndex = null;
    await page.waitForSelector('.cellcontainer [data-function="timeTableCell"]:not([aria-label="Bokad"]');

    for (const date of dateStrings) {
        const index = dateStrings.indexOf(date);
        const isBefore = dayjs(date).isBefore(maxDate);
        console.log("is before", dayjs(date).isBefore(maxDate))
        if (UNAVAILABLE_DATES.indexOf(date) !== -1) {
            console.log("found date " + date + "is in UNAVAILABLE_DATES")
            continue;
        }
        if (isBefore && !wantedIndex) {
            console.log("isBefore at", index)
            const possibleToClickLength = await page.evaluate((date) => {
                let elements = document.querySelectorAll('table.timetable tbody [headers="' + date + '"] .cellcontainer [data-function="timeTableCell"]:not([aria-label="Bokad"]');
                return elements.length;
            }, date);
            if (possibleToClickLength) {
                wantedIndex = index;
            }
        }
    }
    console.log("dateStrings", dateStrings)

    if (wantedIndex) {
        console.log("wantedIndex", wantedIndex)
        const wishedDate = dateStrings[wantedIndex];
        await page.evaluate((wishedDate) => {
            let element = document.querySelector('table.timetable tbody [headers="' + wishedDate + '"] .cellcontainer [data-function="timeTableCell"]:not([aria-label="Bokad"]');
            element.click();
        }, wishedDate);

        await page.waitForSelector('.pointer.timecell.text-center.selected')
        return await proceedWhenFoundTime(page);
    } else {
        await page.waitForTimeout(12000);
        await retryFindTimes(page);
    }
}

async function proceedWhenFoundTime(page) {
    await page.waitForTimeout(500);
    await page.waitForSelector('input[name="Next"]');
    await page.click('input[name="Next"]');
    await page.waitForTimeout(500);

    await page.waitForSelector('#Customers_0__BookingFieldValues_0__Value');
    await page.focus('#Customers_0__BookingFieldValues_0__Value')
    await page.keyboard.type(FIRST_NAME)
    await page.focus('#Customers_0__BookingFieldValues_1__Value')
    await page.keyboard.type(LAST_NAME)

    if (BOOK_PASS === true) {
        await page.click('input#Customers_0__Services_0__IsSelected'); // Bokningen gäller Pass
    }

    if (BOOK_ID_CARD === true) {
        await page.click('input#Customers_0__Services_1__IsSelected'); // Bokningen gäller Id-kort
    }

    await page.click('input[name="Next"]');
    await page.waitForTimeout(200);

    // Viktig information
    await page.waitForSelector('input[name="Next"]');
    await page.click('input[name="Next"]');

    // Kontaktuppgifter
    await page.waitForSelector('#EmailAddress');
    await page.focus('#EmailAddress')
    await page.keyboard.type(EMAIL)
    await page.focus('#ConfirmEmailAddress')
    await page.keyboard.type(EMAIL)

    await page.focus('#PhoneNumber')
    await page.keyboard.type(PHONE_NUMBER)
    await page.focus('#ConfirmPhoneNumber')
    await page.keyboard.type(PHONE_NUMBER);

    await page.click('input#SelectedContacts_0__IsSelected');
    await page.click('input#SelectedContacts_1__IsSelected');
    await page.click('input#SelectedContacts_2__IsSelected');
    await page.click('input#SelectedContacts_3__IsSelected');
    await page.click('input[name="Next"]');

    // Bekräfta bokning
    await page.waitForSelector('input[name="Next"]');
    await page.click('input[name="Next"]');
    await page.waitForTimeout(1000);
    console.log("Completed booking!")
    await page.waitForTimeout(10000);

    //return true;
}