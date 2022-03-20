const puppeteer = require("puppeteer");
const dayjs = require("dayjs");

let page = null;
let browser;

const region = 15;
// 17 = Alingsås
// 15 = Göteborg

const FIRST_NAME = "Anton";
const LAST_NAME = "Peetso";
const EMAIL = "lpstadus@gmail.com";
const PHONE_NUMBER = "0707659438";

const UNAVAILABLE_DATES = [
    "2022-03-21",
    "2022-03-22",
    "2022-03-29",
    "2022-04-06",
    "2022-04-25",
    "2022-04-28",
    "2022-05-10",
    "2022-05-11",
    "2022-05-17",
]

browser = puppeteer.launch({headless: false})

    .then(async (browser) => {
        page = await browser.newPage();
        page.setViewport({
            width: 1400,
            height: 900,
            isMobile: false,
        });
        page.goto("https://bokapass.nemoq.se/Booking/Booking/Index/vastragotaland", {
            waitUntil: "networkidle2",
        });

        // Start
        await page.waitForTimeout(1000);
        await page.click('input[name="StartNextButton"]');
        await page.waitForTimeout(1000);
        // Behandling av personuppgifter
        await page.click('input[name="AcceptInformationStorage"]'); // Jag har tagit del av ovan
        await page.waitForTimeout(500);
        await page.click('input[name="Next"]');
        // Bor du i Sverige?
        await page.waitForTimeout(500);
        await page.click('input[name="ServiceCategoryCustomers[0].ServiceCategoryId"]');
        await page.waitForTimeout(200);
        await page.click('input[name="Next"]');
        // Välj tid
        await page.waitForTimeout(500);
        await page.select('select#SectionId', region.toString()) // Välj Passexpedition
        await page.waitForTimeout(500);
        const result = await retryFindTimes(page);

        if (result === true) {
            await browser.close();
        }
    })
    .catch((error) => {
        console.log(error)
    });

async function retryFindTimes(page) {
    await page.click('input[name="TimeSearchFirstAvailableButton"]'); // Första lediga tid
    await page.waitForTimeout(1000);

    let dates = await page.evaluate(() => {
        let data = [];
        let elements = document.querySelectorAll('table.timetable thead th');
        for (var element of elements) {
            data.push(element.id);
        }
        return data;
    });

    const dateStrings = dates.filter((x) => x.length > 0);

    const maxDate = dayjs().add(31, 'day');
    let wantedIndex = null;

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
    await page.waitForTimeout(100);

    if (wantedIndex) {
        const wishedDate = dateStrings[wantedIndex];
        await page.evaluate((wishedDate) => {
            let element = document.querySelector('table.timetable tbody [headers="' + wishedDate + '"] .cellcontainer [data-function="timeTableCell"]:not([aria-label="Bokad"]');
            element.click();
        }, wishedDate);

        return await proceedWhenFoundTime(page);
    } else {
        await page.waitForTimeout(12000);
        await retryFindTimes(page);
    }
}

async function proceedWhenFoundTime(page) {
    await page.waitForTimeout(500);
    await page.click('input[name="Next"]');

    await page.waitForTimeout(500);
    await page.focus('#Customers_0__BookingFieldValues_0__Value')
    await page.keyboard.type(FIRST_NAME)
    await page.focus('#Customers_0__BookingFieldValues_1__Value')
    await page.keyboard.type(LAST_NAME)
    await page.click('input#Customers_0__Services_0__IsSelected');
    await page.waitForTimeout(500);

    await page.click('input[name="Next"]');
    await page.waitForTimeout(1000);


    // Viktig information
    await page.click('input[name="Next"]');
    await page.waitForTimeout(1000);

    // Kontaktuppgifter
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
    await page.click('input[name="Next"]');
    await page.waitForTimeout(1000);
    console.log("Completed booking!")
    await page.waitForTimeout(10000);

    return true;
}