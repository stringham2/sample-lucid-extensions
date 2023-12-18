import {BlockProxy, EditorClient, Menu, MenuType, Viewport, DocumentProxy, TextMarkupNames, SimpleImageFillPosition, objectValidator, isString} from 'lucid-extension-sdk';

//TODO: Set page to portrait
//TODO: check manifest.json, what do I need still?
const client = new EditorClient();
const menu = new Menu(client);
const viewport = new Viewport(client);
const document = new DocumentProxy(client);

const TABLE_ROWS = 5;
const CELL_SIZE = 220;
const MINIMUM_IMAGES = TABLE_ROWS*TABLE_ROWS + TABLE_ROWS;
const numberOfCardsToGenerate = [1,3,5,10,15,25];

const imageFillValidator = objectValidator({
    'url': isString
});

numberOfCardsToGenerate.forEach(numberOfCards => {
    client.registerAction(`generateBingoCards${numberOfCards}`, () => {
        generateAllBingoCards(numberOfCards);
    });
});


client.registerAction('notEnoughImagesToGenerateBingoCard', () => {
    const items = viewport.getSelectedItems(true).filter(x => {
        x.properties.get('FillColor');
        if(imageFillValidator(x.properties.get('FillColor'))) {
            return true
        }
        return false;
    });

    return items.length < MINIMUM_IMAGES;
});


async function init() {
    await client.loadBlockClasses(['ImageSearchBlock2','DefaultTableBlock', 'DefaultSquareBlock']);
    numberOfCardsToGenerate.forEach(numberOfCards => {
        menu.addMenuItem({
            label: `Generate ${numberOfCards} Bingo Card${numberOfCards == 1 ?'':'s'}`,
            action: `generateBingoCards${numberOfCards}`,
            menuType: MenuType.Context,
            disabledAction: 'notEnoughImagesToGenerateBingoCard',
        })
    })
}

init();

function boldAndSetFontSize(block:BlockProxy, fontSize:number) {
    for (const ta of block.textAreas.keys()) {
        block.textStyles.set(ta, {
            [TextMarkupNames.Bold]: true,
            [TextMarkupNames.Size]: fontSize
        });
    }
}

async function generateAllBingoCards(cards:number) {
    const page = document.addPage({'title': `${cards} Bingo Cards`});
    const dpi = page.properties.get('DPI') as number;
    const pageSize = {w: 8.5*dpi, h:11*dpi};
    page.properties.set('Margin', 0);
    page.properties.set('Size', pageSize);
    page.properties.set('SkipMultipage', false);//set pages to auto-tile
    page.properties.set('InfiniteCanvas', false);

    // GET ALL SELECTED IMAGES
    const images:string[] = viewport.getSelectedItems(true).map(item => {
        let fill = item.properties.get('FillColor');

        if(imageFillValidator(fill)) {
            return fill.url;
        }
        return undefined;

    }).filter(isString);


    //Draw Caller Cards
    const callerIconSize = Math.round(CELL_SIZE*2.5);

    let marginForPrinting = .1*dpi;
    
    const callerIconsPerRow = Math.trunc((pageSize.w-(2*marginForPrinting))/callerIconSize)
    const callerIconsPerColumn = Math.trunc((pageSize.h-(2*marginForPrinting))/callerIconSize);
    const callerIconsPerPage = callerIconsPerRow*callerIconsPerColumn;
    const marginForPrintingX = (pageSize.w - (callerIconsPerRow*callerIconSize)) / 2;
    const marginForPrintingY = (pageSize.h - (callerIconsPerColumn*callerIconSize)) / 2

    const cardsPerRow = 5;

    for(var i=0; i<images.length; i++) {
        let callerIconPosition = {
            x: marginForPrintingX + (pageSize.w * (Math.trunc(i/callerIconsPerPage)%cardsPerRow)) + (callerIconSize * (i%callerIconsPerRow)),
            y: marginForPrintingY + (pageSize.h * Math.trunc(i/(callerIconsPerPage*cardsPerRow))) + callerIconSize * Math.trunc((i%callerIconsPerPage)/(callerIconsPerRow))
        };

        let image = page.addBlock({
            className: 'ImageSearchBlock2',
            boundingBox: {
                x: callerIconPosition.x + .1*callerIconSize,
                y: callerIconPosition.y + .1*callerIconSize,
                w: callerIconSize*.8,
                h: callerIconSize*.8},
            lineWidth: 0,
            fillStyle: {
                url: images[i],
                position: SimpleImageFillPosition.Fit,
            }
        });
    }


    
    //TODO: maybe don't add a page in Lucidspark but instead find area big enough.
    const callerCardPages = Math.ceil(images.length/callerIconsPerPage);

    for(var i=0; i<cards; i++) {

        const pageOffset = {x: ((i+callerCardPages)%cardsPerRow) * pageSize.w , y: Math.trunc((i+callerCardPages)/cardsPerRow) * pageSize.h};

        const title = page.addBlock({
            className: 'DefaultSquareBlock',
            boundingBox: {x:pageOffset.x + 130, y:pageOffset.y + 120, w: 1100,h:250},
            lineWidth: 0,
            fillStyle: '#ffffff00',
            properties: {
                Text: 'BINGO'
            }
        });

        boldAndSetFontSize(title, 80);

        const tableX = pageOffset.x + 130;
        const tableY = pageOffset.y + 460;

        //default table block has 3 cells
        const table = page.addBlock({
            className:'DefaultTableBlock',
            boundingBox:{
                x:tableX, y:tableY, w:CELL_SIZE*5, h:CELL_SIZE*TABLE_ROWS
            },
            lineWidth: 5,
            properties: {
                ColWidths: Array(TABLE_ROWS).fill(CELL_SIZE),
                RowHeights: Array(TABLE_ROWS).fill(CELL_SIZE)
            }
        });
        
        let bingoCardImages = generateBingoCard(images);

        const cellBuffer = CELL_SIZE*.05;

        for(var x=0; x<TABLE_ROWS; x++) {
            for(var y=0; y<TABLE_ROWS; y++) {
                let bb = {x: tableX+x*CELL_SIZE+cellBuffer, y:tableY+y*CELL_SIZE+cellBuffer, w: CELL_SIZE-2*cellBuffer, h: CELL_SIZE-2*cellBuffer};
                if(x == y && TABLE_ROWS - 1 == 2*x) {
                    const free = page.addBlock({
                        className: 'DefaultSquareBlock',
                        boundingBox: bb,
                        lineWidth: 0,
                        fillStyle: '#ffffff00',
                        properties: {
                            Text: 'FREE'
                        }
                    });
                    boldAndSetFontSize(free, 25);
                } else {
                    let image = page.addBlock({
                        className: 'ImageSearchBlock2',
                        boundingBox: {x: tableX+x*CELL_SIZE+cellBuffer, y:tableY+y*CELL_SIZE+cellBuffer, w: CELL_SIZE-2*cellBuffer, h: CELL_SIZE-2*cellBuffer},
                        lineWidth: 0,
                        fillStyle: {
                            url: bingoCardImages[x + y*TABLE_ROWS],
                            position: SimpleImageFillPosition.Fit,
                        }
                    });
                }
            }
        }

    }
}

function generateBingoCard(images: Array<string>):Array<string> {
    for(var i=images.length - 1; i>=0; i--) {
        const swapPosition = Math.floor(Math.random()*i+1);
        [images[i], images[swapPosition]] = [images[swapPosition], images[i]]; 

    }
    return images;
}


/*
I cant find a way to create a page
- oh it's addPage. CreatePage Command (and probably other commands) should have note/link for what method we expect extension authors to use to do that action

----------------------------
Block Definition
The properties seem like this coudl be much simpler
Instead of
boundingBox
• boundingBox: Box
The initial location and size of the block on the page.

className
• className: string


What if we did

{
    boundingBox: Box // initial location and size of block on the page
    className: string // The type of block to create, e.g. "ProcessBlock".

}

----------------------------
It's hard to knwo what shape to get. Can we have even a "to figure out what block you want to use, check this way in the document"



----------------------------
Table
I wish I could say "create x by y table that has this bounding box"
Instead I hae to create a table with a bounding box
Then add a column/row until I get ot the right size (and then check column/row widths)


It seems weird that deleteRow takes a number, but addRow takes a referenceCell

----------------------------
I wrote page.addBlock('TableBlock') instead of 'DefaultTableBlock', no error or anything.

----------------------------
DebugLocalExctension & LoadLocalExtension can both be checked. They were both checked, I unchecked LoadLocalExtension and had to uncheck/recheck debug local extension.

----------------------------
Table

----------------------------
It's super painful to set text style. I just want to copy what's set in the editor.
I know this block just has one text area. I just want to bold it and 

Could we abstract this & say "setTextStyleForBlock/Item" (or something). My guess is most extensions won't want formatting different within a single shape.


        for (const ta of item.textAreas.keys()) {
            const oldStyle = item.textStyles.get(ta);
            await item.textStyles.set(ta, {
                [TextMarkupNames.Bold]: !oldStyle[TextMarkupNames.Bold],
            });
        }

----------------------------
I want to copy shapes - there isn't really a way to.


ImageSearchBlock2


There's not a getFillStyle. I wanted to do this to copy fill style. 
Had to do item.properties.getItem('FillColor').url
This was hard to figure out.
I expected these properties to be on item.allShapeData() - maybe I'm just confused by that name



-----------------------------
Set page size
finally found properties on pageProxy

properties says
`All properties available on this element, organized by name. Not all properties are writeable (e.g. "ClassName" on a block). To move or resize elements, use setLocation() or setBoundingBox() or offset() instead.`
But I dont see a setBoundingBox on page. Do I do page.properties.setBoundingBox?
page.setBoundingBox doesn't work. Hmm

----------------------------
Shuld I have to reload to get new code in editor?
-----------------------------
if I can register actions, could I also create a shape that when you click it it does that action?
like a frame with a "generate bingo card" button, that looked at the # of cards you wanted to generate? I'd rather have that as a shape that you can drag out and then interact with than add to a menu.
this coudl be could becuase I could use CF to say add more images until there are enough....
and maybe I could have a text area to input how big of a table you want...
-----------------------------
how to know if disabled/visible action is performant enough?

should my fucntion block the main thread? If i generate 20, it stalls for awhile. Can it happen in the background?
------------------------------

there is a way to addPage

I can't find a way to delete a page though.

// client.registerAction(`deleteOtherPages`, () => {
//     let currentPage = viewport.getCurrentPage();
//     document.pages.map((page) => {
//         document.removePage
//     })    
// });

// menu.addMenuItem({
//     label: `Delete Other Pages`,
//     action: `deleteOtherPages`,
//     menuType: MenuType.Context,
// });




----------------------------------------
Performance

With Profiler Slow Table
25 cards took 31 seconds,

With Profiler Table improvments 
25 cards took 15 seconds


Without Profiler 25 cards took 7 seconds



Optimized setting properties/linewidth when adding block, down to 5 seconds


Adding rows & columns to table was super slow. Instead set ColWidths & RowHeights when creating shape.

Settign properties after creating blocks also was slow.




--------------------------
    const images:string[] = viewport.getSelectedItems(true).map(item => {
        let fill = item.properties.get('FillColor');

        if(imageFillValidator(fill)) {
            return fill.url;
        }
        return undefined;

        // what I tried to do
        // if(isJsonObject(fill) && fill.url && typeof fill.url == 'string'){
        //     let url :string = fill.url;
        //     items.push(url)
        // }
        // return items;
    }).filter(isString);

*/