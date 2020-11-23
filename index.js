const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const scrape = require('website-scraper');
const {
    readdirSync
} = require('fs');
const fs = require('fs-extra');
const zip = require('express-easy-zip');
const AD_RESARCH = 'ad_resarch';
const FOLDER_NAME = 'HTML_Ads';
const axios = require('axios');

const getDirectories = source =>
    readdirSync(source, {
        withFileTypes: true
    })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

const getFiles = source =>
    readdirSync(source, {
        withFileTypes: true
    })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);



const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(zip());
app.get('/', function(request, response) {
    response.sendFile(path.join(__dirname + '/index.html'));
});

app.post('/search', async function(request, response) {
    let searchKeyWords = request.body.search;
    if (searchKeyWords) {
        if (fs.existsSync(`./${FOLDER_NAME}`)) {
            fs.removeSync(`./${FOLDER_NAME}`);
        }
        let searchArray = searchKeyWords.split(',');
        for (let searchKeyWord of searchArray) {
            searchKeyWord = searchKeyWord.trim();
            let data = await axios.get(`https://moat.com/api/autocomplete?q=${searchKeyWord}&report_type=all&fuzzy=true&show_empty=false&page_size=10&doc_type=advertiser`);
            searchKeyWord.replace(/(^\w{1})|(\s{1}\w{1})/g, match => match.toUpperCase());
            if (data.data) {
                data = data.data;
                let obj = data.find(o => o.name === searchKeyWord.replace(/(^\w{1})|(\s{1}\w{1})/g, match => match.toUpperCase()) || o.name === searchKeyWord.toUpperCase());
                if (obj) {
                    let dateData = await axios.get(`https://moat.com/api/entity_report/advertiser/${obj.slug}/entity_info?filter=all&report_type=display`);
                    dateData = dateData.data;
                    if (dateData) {
                        let countData = await axios.get(`https://moat.com/api/entity_report/advertiser/${obj.slug}/counts/creatives?end_date=${dateData.max_date}&filter=all&report_type=display&start_date=${dateData.min_date}&report_type=video&report_type=high_impact&report_type=display&report_type=native`);
                        countData = countData.data;
                        if (countData) {
                            let timeData = await axios.get(`https://moat.com/api/entity_report/advertiser/${obj.slug}/creatives_query_info?end_date=${dateData.max_date}&filter=all&report_type=display&start_date=${dateData.min_date}`);
                            timeData = timeData.data;

                            if (timeData) {
                                let urlData = await axios.get(`https://moat.com/creatives/advertiser/${obj.slug}?device=desktop&device=mobile&end_date=${dateData.max_date}&filter=all&page=0&page_size=${countData.display.creatives_total.total -1}&period=month&report_type=display&start_date=${dateData.min_date}&load_time=${timeData.load_time}&time_hash=${timeData.time_hash}`);
                                urlData = urlData.data;
                                urlData = urlData['creative_data'];
                                if (fs.existsSync(`./${FOLDER_NAME}/${obj.slug}`)) {
                                    fs.removeSync(`./${FOLDER_NAME}/${obj.slug}`);
                                }
                                for (let i = 0; i < urlData.length; i++) {
                                    if (urlData[i].type == 'html5') {
                                        let directoryPath = urlData[i].src.replace(/^https?:\/\//, '');
                                        directoryPath = directoryPath.replace(/\//g, ":");
                                        let options = {
                                            urls: [urlData[i].src],
                                            directory: `./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${directoryPath}`,
                                            ignoreErrors: true,
                                            subdirectories: [{
                                                    directory: 'fonts',
                                                    extensions: ['.woff', '.ttf', '.woff2', '.otf', '.pfa', '.fnt', '.fot', '.glif', '.eot']
                                                }, {
                                                    directory: 'js',
                                                    extensions: ['.js']
                                                },
                                                {
                                                    directory: "html",
                                                    extensions: ['.html']
                                                },
                                                {
                                                    directory: "images",
                                                    extensions: ['.png', '.jpg', '.jpeg', '.svg']
                                                },
                                                {
                                                    directory: "css",
                                                    extensions: ['.css']
                                                }
                                            ],
                                        };
                                        await scrape(options);
                                    }
                                }
                                console.log("Downloaded the Fonts");
                                const subDirectory = getDirectories(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}`);
                                for (let i = 0; i < subDirectory.length; i++) {
                                    try {
                                        if (fs.existsSync(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}/fonts`)) {
                                            let internalSubDirectory = getDirectories(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}`);
                                            for (let j = 0; j < internalSubDirectory.length; j++) {
                                                if (internalSubDirectory[j] != 'fonts') {

                                                    fs.removeSync(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}/${internalSubDirectory[j]}`);
                                                } else {
                                                    let fontFiles = getFiles(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}/${internalSubDirectory[j]}`);
                                                    for (let k = 0; k < fontFiles.length; k++) {
                                                        let extractPath = `./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}`;
                                                        fs.copySync(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}/${internalSubDirectory[j]}/${fontFiles[k]}`, extractPath + `/${fontFiles[k]}`);
                                                    }
                                                    fs.removeSync(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}/${internalSubDirectory[j]}`);
                                                }
                                            }
                                        } else {
                                            await fs.remove(`./${FOLDER_NAME}/${obj.slug}/${AD_RESARCH}/${subDirectory[i]}`);
                                        }
                                    } catch (e) {
                                        console.log(e);
                                        console.log("An error occurred.")
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.log("not found");
                }
            }
        }

        const dirPath = __dirname + "/" + FOLDER_NAME;
                                await response.zip({
                                    files: [{
                                        path: dirPath,
                                        name: FOLDER_NAME
                                    }],
                                    filename: `${FOLDER_NAME}.zip`
                                });

    }
});


app.listen(3000);