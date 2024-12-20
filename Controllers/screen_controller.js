const asyncHandler = require("express-async-handler");
const Screen = require("../Models/screen");
const Module = require("../Models/module");
const Controller = require("../Models/controller");
const PDFDocumentKit = require("pdfkit");
const { PDFDocument } = require("pdf-lib");
const { exec } = require("child_process");
//import PDFMerger from 'pdf-merger-js';

const fs = require("fs");
//create functions to get all screens and add a new screen
const getAllScreens = asyncHandler(async (req, res) => {
  try {
    const screens = await Screen.find();
    res.status(200).json(screens);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

const screenCreation = asyncHandler(async (req, res) => {
  const name = req.body.name;
  const width = req.body.width;
  const height = req.body.height;
  const module = req.body.module;
  const numberOfReceivingCards = req.body.numberOfReceivingCards;
  const controller = req.body.controller;
  const powerSupply = req.body.powerSupply;
  const steelStructure = req.body.steelStructure;
  const category = req.body.category;
  try {
    const screenToCreate = await Screen.create({
      name,
      width,
      height,
      module,
      numberOfReceivingCards,
      controller,
      powerSupply,
      steelStructure,
      category,
    });

    res.status(200).json(screenToCreate);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

const calculateScreen = asyncHandler(async (req, res) => {
  const width = req.body.width;
  const height = req.body.height;
  const moduleId = req.body.module;
  const type = req.body.type;

  console.log(width, height, moduleId);
  const module = await Module.findById(moduleId);
  const pixelpitch = module.pixelpitch;
  const type2 = module.type;
  const moduleWidth = module.width;
  const moduleHeight = module.height;
  const modulesInWidth = Math.floor((width * 100) / moduleWidth);
  const modulesInHeight = Math.floor((height * 100) / moduleHeight);
  console.log(modulesInWidth, modulesInHeight);

  let cabinetsNumber = width * height;
  let totalModules = cabinetsNumber * 18;
  let powerSupplyNumber = cabinetsNumber * 3;
  let numberOfReceivingCards = cabinetsNumber;
  console.log(
    cabinetsNumber,
    powerSupplyNumber,
    numberOfReceivingCards,
    totalModules
  );
  const screenWidth = width * 0.96;
  const screenHeight = height * 0.96;
  console.log(screenWidth, screenHeight);
  let viewingDistance = 0;
  const pixelsPerModule = Math.floor(
    ((moduleWidth * 10) / module.pixelpitch) *
      ((moduleHeight * 10) / module.pixelpitch)
  );
  const totalPixels = totalModules * pixelsPerModule;
  console.log(totalPixels);

  if (type === "outdoor") {
    viewingDistance = module.pixelpitch;
  } else {
    viewingDistance = module.pixelpitch;
  }
  const controllers = await Controller.find();

  const suitableControllers = controllers.filter(
    (controller) =>
      controller.portsNumber * controller.maxPixelCapacity >= totalPixels
  );
  console.log(suitableControllers);
  if (suitableControllers.length === 0) {
    // No suitable controller found
    return null;
  }

  // Find the controller with the smallest excess capacity
  let bestController = suitableControllers[0];
  let minExcessCapacity =
    bestController.portsNumber * bestController.maxPixelCapacity - totalPixels;

  for (let i = 1; i < suitableControllers.length; i++) {
    const currentController = suitableControllers[i];
    const currentCapacity =
      currentController.portsNumber * currentController.maxPixelCapacity;
    const excessCapacity = currentCapacity - totalPixels;

    if (excessCapacity < minExcessCapacity) {
      bestController = currentController;
      minExcessCapacity = excessCapacity;
    }
  }

  let screenArea = screenWidth * screenHeight;
  let totalPrice = 0;
  if (module.pixelpitch == 1.8 && module.type == "indoor_GOB") {
    totalPrice = 94500 * screenArea;
  } else if (module.pixelpitch == 1.8 && module.type == "indoor_flex") {
    totalPrice = 90450 * screenArea;
  } else if (module.pixelpitch == 1.8 && module.type == "indoor") {
    totalPrice = 75600 * screenArea;
  } else if (module.pixelpitch == 2.5) {
    totalPrice = 53325 * screenArea;
  } else if (module.pixelpitch == 4 && module.type == "indoor") {
    totalPrice = 41175 * screenArea;
  } else if (module.pixelpitch == 4 && module.type == "outdoor") {
    totalPrice = 116100 * screenArea;
  } else if (module.pixelpitch == 5) {
    totalPrice = 60075 * screenArea;
  } else if (module.pixelpitch == 8) {
    totalPrice = 51975 * screenArea;
  }
  totalPrice += bestController.price;
  totalPrice += screenArea * 5000;

  res.status(200).json({
    pixelpitch,
    type2,
    totalModules,
    bestController,
    screenWidth,
    screenHeight,
    cabinetsNumber,
    viewingDistance,
    powerSupplyNumber,
    numberOfReceivingCards,
    totalPixels,
    totalPrice,
    screenArea,
  });
});
const generateStyledPDF = asyncHandler(async (req, res) => {
  const doc = new PDFDocumentKit({ margin: 50 });
  const screenData = req.body;
  const { default: PDFMerger } = await import("pdf-merger-js");

  const writeStream = fs.createWriteStream("./pdfs/quotation.pdf");
  // Output File
  doc.pipe(writeStream);

  // Header Section
  doc.image("./sonic-final-2020.png", 50, 20, { width: 100 }); // Replace with your logo

  doc.moveDown();
  doc
    .moveDown()
    .fontSize(10)
    .text(`PI NO: CL202411716`, 50, 80)
    .text(`INVOICE TO: `)
    .text(`ATTN: `)
    .text(`TEL: `)
    .text(`COMPANY: `)
    .text(`ADDRESS: `);

  // Table Header
  doc
    .moveDown()
    .fontSize(10)
    .text("S/N", 50, 160)
    //.text("|", 80, 160)
    .text("Commodity", 100, 160, { width: 140 })
    //.text("|", 240, 160)
    .text("Quantity", 250, 160)
   // .text("|", 300, 160)
    .text("Unit", 320, 160)
   // .text("|", 360, 160)
    .text("Unit Price (EGP)", 370, 160)
    //.text("|", 450, 160)
    .text("Total Price (EGP)", 460, 160);

  doc.moveTo(50, 175).lineTo(550, 175).stroke();

  // Table Rows
  let y = 190;
  doc
  .moveTo(80, 160)
  .lineTo(80, y + 200) // Adjust the height based on table content
  //.dash(2, { space: 2 })
  .stroke();

doc
  .moveTo(240, 160)
  .lineTo(240, y + 200)
 // .dash(2, { space: 2 })
  .stroke();

doc
  .moveTo(300, 160)
  .lineTo(300, y + 200)
  //.dash(2, { space: 2 })
  .stroke();

doc
  .moveTo(360, 160)
  .lineTo(360, y + 200)
  //.dash(2, { space: 2 })
  .stroke();

doc
  .moveTo(450, 160)
  .lineTo(450, y + 200)
 // .dash(2, { space: 2 })
  .stroke();

// doc
//   .moveTo(550, 160)
//   .lineTo(550, y + 200)
//   //.dash(2, { space: 2 })
//   .stroke(); 
  // Add items based on new `screenData` structure
  const items = [
    {
      name: `P${screenData.pixelpitch} ${screenData.type2}  LED display 
Actual Size: ${screenData.screenWidth}*${screenData.screenHeight}m
Screen Area : ${screenData.screenArea} m2
+Novastar receiver card+
G-energy Power supply+
Module Size: 32*16cm
`,
      quantity: 1,
      unit: "pcs",
      unitPrice: 0,
      totalPrice: screenData.totalPrice - screenData.bestController.price,
    },
    {
      name: "LED Modules",
      quantity: screenData.totalModules,
      unit: "pcs",
      unitPrice: 0,
      totalPrice: screenData.totalModules * 0,
    },
    {
      name: `${screenData.bestController.name} Controller`,
      quantity: 1,
      unit: "pcs",
      unitPrice: screenData.bestController.price,
      totalPrice: screenData.bestController.price,
    },
    {
      name: "Power Supplies",
      quantity: screenData.powerSupplyNumber,
      unit: "pcs",
      unitPrice: 0,
      totalPrice: screenData.powerSupplyNumber * 0,
    },
    {
      name: "Receiving Cards",
      quantity: screenData.numberOfReceivingCards,
      unit: "pcs",
      unitPrice: 0,
      totalPrice: screenData.numberOfReceivingCards * 0,
    },{
      name: "Cabinets Number",
      quantity: screenData.cabinetsNumber,
      unit: "pcs",
      unitPrice: 0,
      totalPrice: screenData.cabinetsNumber * 0,
    },
  ];

  items.forEach((item, index) => {
    const itemHeight = item.name.split("\n").length * 12;
    if (index === 0) {
      doc.font("Helvetica-Bold");
    } else {
      doc.font("Helvetica");
    }
    doc
      .fontSize(8)
      .text(index + 1, 50, y)
      //.text("|", 80, y)
      .text(item.name, 100, y)
      //.text("|", 240, y)
      .text(item.quantity, 250, y)
     // .text("|", 300, y)
      .text(item.unit, 320, y)
     // .text("|", 360, y)
      .text(`${item.unitPrice}`, 380, y)
     // .text("|", 450, y)
      .text(`${item.totalPrice}`, 470, y);
    y += Math.max(itemHeight, 20);
  });

  // Total Amount
  doc.moveDown().moveTo(50, y).lineTo(550, y).stroke();

  y += 10;
  doc
    .fontSize(9)
    .text("Total Amount (EGP):", 365, y)
    .text(`${screenData.totalPrice.toFixed(2)}`, 470, y);

  // Footer Section
  y += 40;
  //doc.moveTo(50, y).lineTo(550, y).stroke().moveDown();

  y += 10;
  doc
    .fontSize(10)
    .text("Wire Transfer Banking Info", 50, y)
    .moveDown()
    .text(`Beneficiary Account (USD): `)
    .text(`Beneficiary Name: `)
    .text(`Swift Code: `)
    .text(`Beneficiary Bank Name: `)
    .text(`Beneficiary Bank Address:`)
    .moveDown()
    .text(
      `Warranty Terms: 3 years warranty. Customer to send broken parts for repair. Shipping costs shared.`
    )
    .text(`Production Lead Time: 15-18 working days after payment.`)
    .moveDown()
    .text("Thank you for your business!", { align: "center" });

  doc.end();
  await new Promise((resolve) => writeStream.on("finish", resolve));
  let pdf ;
  if(screenData.pixelpitch == 1.86 && screenData.type2 == "indoor"){
    pdf ="./pdfs/Indoor Q1.8-43S-H-1515 Specification.pdf";
  }else if (screenData.pixelpitch == 1.8 && screenData.type2 == "indoor_GOB"){
    pdf = "./pdfs/Indoor Q1.8-43S-H-1515 GOB Specification.pdf";
  }else if(screenData.pixelpitch == 1.8 && screenData.type2 == "indoor_flex"){
    pdf = "./pdfs/indoor Q1.8-43S-1515-H-R.pdf";
  }else if(screenData.pixelpitch == 2.5 ){
    pdf = "./pdfs/Indoor Q2.5-32s-H-2020 Specification.pdf";
  }else if(screenData.pixelpitch == 4 ){
    pdf = "./pdfs/Indoor Q4-20s-H-2020 Specification.pdf";
  }else if(screenData.pixelpitch == 5){
    pdf = "./pdfs/Outdoor Q5-8S-H-2525.pdf";
  }else if(screenData.pixelpitch == 8){
    pdf = "./pdfs/Outdoor Q8-5S-H-3535.pdf";
  }
  exec(
    `python ./controllers/scripts/merge_pdfs.py "${pdf}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error('Error merging PDFs:', stderr || error.message);
        res.status(500).json({ error: stderr || error.message });
        return;
    }

    console.log('Merge Script Output:', stdout);
    res.status(200).json({
        message: "PDF generated and merged successfully",
        downloadLink: `${req.protocol}://${req.get('host')}/pdfs/final_quotation.pdf`,
    });
    }
  );
});

// Example Data
// const screenData = {
//     buyerName: 'Gasser',
//     buyerContact: 'Gasser',
//     buyerPhone: '+20 11 15277881',
//     buyerCompany: 'Sonic Technologies',
//     buyerAddress: 'Address',
//     items: [
//         {
//             name: 'P1.86 Indoor GOB Front Service LED Display',
//             quantity: 48,
//             unit: 'pcs',
//             unitPrice: 265,
//             totalPrice: 12720,
//         },
//         {
//             name: 'Colorlight X20 Controller',
//             quantity: 1,
//             unit: 'pcs',
//             unitPrice: 1950,
//             totalPrice: 1950,
//         },
//         {
//             name: 'Wooden Case',
//             quantity: 6,
//             unit: 'pcs',
//             unitPrice: 50,
//             totalPrice: 300,
//         },
//     ],
//     totalPrice: 14970,
//     bankDetails: {
//         account: '4000027119201743521',
//         name: 'SHENZHEN COLORLIT LED CO., LTD.',
//         swift: 'ICBKCNBJSZN',
//         bankName: 'Industrial and Commercial Bank of China',
//         bankAddress: 'North Block, Financial Center, Shennan Road East, Shenzhen, China',
//     },
//     warranty: '3 years warranty. Customer to send broken parts for repair. Shipping costs shared.',
//     leadTime: '15-18 working days after payment.',
// };

// Generate the PDF
// generateStyledPDF(screenData, 'quotation.pdf');

const getScreenById = asyncHandler(async (req, res) => {
  try {
    const screen = await Screen.findById(req.params.id);
    res.status(200).json(screen);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

const updateScreen = asyncHandler(async (req, res) => {
  try {
    const screen = await Screen.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json(screen);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

const deleteScreen = asyncHandler(async (req, res) => {
  try {
    const screen = await Screen.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
});

module.exports = {
  getAllScreens,
  screenCreation,
  calculateScreen,
  getScreenById,
  updateScreen,
  deleteScreen,
  generateStyledPDF,
};
