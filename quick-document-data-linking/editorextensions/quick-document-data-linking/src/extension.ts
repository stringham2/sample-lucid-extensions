import {DataProxy, DocumentProxy, EditorClient, GetItemsAtSearchType, Menu, MenuType, Viewport, arrayValidator, isNumber, isString} from 'lucid-extension-sdk';
import {ImportModal} from './importmodal';

const client = new EditorClient();
const menu = new Menu(client);
const viewport = new Viewport(client);
let document = new DocumentProxy(client);

//TODO: check manifest.json

//TODO: create documents from data (validate it works)
// create sample document with 4 shapes
//to create a document
//cities
//for each city
//    create copy of template, name it EXAMPLE - [City]


//TODO: set sheet tab name, header title (and header field?) as somethign that can be specified on canvas (or in installation instructions)
//TODO: set header title as something that can be set on the canvas? probably not, maybe in a modal?


client.registerAction('fillShapesWithData', () => {
    const sheetName = 'Sheet1';
    const filterId = 'ID'; // change to be on page input? but then they have to delete stuff from every document... `DESCENDANTS(PAGE).filterId`
    const filterKey = 'Location'; //change to formula, so I can grab it off the page? `DESCENDANTS(PAGE).filterKey`

    const docTitle = document.getTitle();
    const filterValueFromDocTitleRegex = /\[(.*)\]/; 
    
    let filterValue = '';
    let match = docTitle.match(filterValueFromDocTitleRegex);
    if(match && match.length > 1) {
        filterValue = match[1];
    } else {
        console.log('\n\nERROR, title does not match format needed');
    }


    const data = new DataProxy(client);

    function findData() {
        for (const [key, source] of data.dataSources) {
            if (source.id) {
                for (const [collectionId, collection] of source.collections) {
                    if (collection.getName() === sheetName) {
                        return collection
                    }
                }
            }
        }
        return undefined;
    }


    let collection = findData();
    if(collection) {
        const page = viewport.getCurrentPage();
        if(page) {
            let offices = page.executeFormula(`FILTER(LOOKUP('${sheetName}'), x=> x.${filterKey} = '${filterValue}').'${filterId}'`)
            let blockIds = page.executeFormula("FILTER(DESCENDANTS(PAGE), x=> x.shouldApplyData).$id"); //could have created a custom shape
            if(isString(offices)) {
                offices = [offices];
            }
            if(isString(blockIds)) {
                blockIds = [blockIds];
            }

            const numberArrayValidator = arrayValidator(isNumber);
            const stringArrayValidator = arrayValidator(isString);
    
            if(numberArrayValidator(offices) && stringArrayValidator(blockIds)) { //TODO: maybe document how to use validators - or use these in our examples
                const blocks = blockIds.map(blockId => client.getBlockProxy(blockId)
                ).sort((block1, block2) => {
                    let bb1 = block1.getBoundingBox();
                    let bb2 = block2.getBoundingBox();

                    return bb1.y - bb2.y || bb1.x - bb2.x;
                })
                if(blocks.length >= offices.length) {
                    for(var i=0; i<blocks.length; i++) {
                        let block = blocks[i];


                        if(i < offices.length) {
                            let officeId = offices[i];
                            // Documentation says: Set a reference key on this element, replacing any existing reference at the specified key.
                            // It adds the data, but it doesn't replace data that's already set :(
                            block.setReferenceKey('ID', {
                                collectionId: collection.id,
                                primaryKey: officeId.toString(),
                                readonly: false
                            });
                        } else {
                            //delete all the unused shapes
                            let containedItems = page.findItems(block.getBoundingBox(), GetItemsAtSearchType.Contained);
                            containedItems.forEach(item => item.delete());
                        }
                    }
                } else {
                    console.log("\n\nNOT ENOUGH SHAPES ON THE PAGE-----------------------\n\n")//TODO add error to page?
                }
            } else {
                console.log("\n\nFORMUAL ERROR-----------------------\n\n")//TODO give an actionable error
            }
        }
    }
});

client.registerAction('createDocumentsFromData', () => {

});


menu.addMenuItem({
    label: 'Fill Shapes With Data',
    action: 'fillShapesWithData',
    menuType: MenuType.Main,
});

menu.addMenuItem({
    label: 'Create Documents From Data (TODO)',
    action: 'createDocumentsFromData',
    menuType: MenuType.Main,   
})

