import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarketProduct from './models/MarketProduct.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codalina';

async function seedProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const products = [
      {
        title: "Next.js AI SaaS Boilerplate",
        description: "The ultimate Next.js 14 boilerplate for building AI-powered SaaS apps. Includes authentication, Stripe integration, Prisma, and OpenAI API examples.",
        photos: ["https://api.dicebear.com/7.x/shapes/svg?seed=NextJS"],
        cost_price: 0,
        original_price: 199,
        selling_price: 99,
        status: "Live",
        productType: "SaaS Tool",
        licenseType: "Personal",
        demoUrl: "https://demo.codalina.com/nextjs-ai-saas",
        documentationUrl: "https://docs.codalina.com/nextjs-ai-saas",
        techStack: ["Next.js", "React", "Prisma", "TailwindCSS", "Stripe"],
        fileFormat: ".zip",
        fileSize: "2.4 MB",
        version: "1.0.0",
        downloadUrl: "https://example.com/download/nextjs-ai-saas.zip",
        screenshotGallery: [
          "https://api.dicebear.com/7.x/shapes/svg?seed=NextJS",
          "https://api.dicebear.com/7.x/shapes/svg?seed=NextJS2"
        ],
        isLatest: true,
        isFeatured: true,
        isPopular: true
      },
      {
        title: "E-Commerce UI Kit",
        description: "A complete set of beautifully designed, fully responsive React components for building high-converting e-commerce storefronts.",
        photos: ["https://api.dicebear.com/7.x/shapes/svg?seed=UIKit"],
        cost_price: 0,
        original_price: 89,
        selling_price: 49,
        status: "Live",
        productType: "UI Kit/Plugin",
        licenseType: "Personal",
        demoUrl: "https://demo.codalina.com/ecommerce-ui-kit",
        techStack: ["React", "TailwindCSS", "Framer Motion"],
        fileFormat: ".zip",
        fileSize: "1.2 MB",
        version: "2.1.0",
        downloadUrl: "https://example.com/download/ecommerce-ui-kit.zip",
        screenshotGallery: [
          "https://api.dicebear.com/7.x/shapes/svg?seed=UIKit",
          "https://api.dicebear.com/7.x/shapes/svg?seed=UIKit2"
        ],
        isLatest: true,
        isFeatured: true
      },
      {
        title: "Python Web Scraper Pro",
        description: "A highly concurrent Python script using asyncio and BeautifulSoup to scrape and extract data from websites incredibly fast. Includes proxy rotation and captcha solving examples.",
        photos: ["https://api.dicebear.com/7.x/shapes/svg?seed=Python"],
        cost_price: 0,
        original_price: 59,
        selling_price: 29,
        status: "Live",
        productType: "Script/Automation",
        licenseType: "Personal",
        documentationUrl: "https://docs.codalina.com/python-scraper",
        techStack: ["Python", "Asyncio", "BeautifulSoup"],
        fileFormat: ".py",
        fileSize: "45 KB",
        version: "1.5.2",
        downloadUrl: "https://example.com/download/python-scraper.py",
        screenshotGallery: [
          "https://api.dicebear.com/7.x/shapes/svg?seed=Python"
        ],
        isLatest: true,
        isPopular: true
      }
    ];

    for (const product of products) {
      await MarketProduct.create(product);
      console.log(`Created: ${product.title}`);
    }

    console.log('Seeding complete.');
  } catch (error) {
    console.error('Error seeding products:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedProducts();
