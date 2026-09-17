const Stripe = require("stripe");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY is missing. Add it in Netlify Environment Variables."
  );
}

const stripe = new Stripe(stripeSecretKey);

const PRODUCTS = {
  "wilson-pro-staff-97-v14": {
    name: "Wilson Pro Staff 97 v14 tenisa rakete",
    amount: 25900,
    description: "Profesionāla līmeņa tenisa rakete"
  },
  "head-radical-mp": {
    name: "Head Radical MP tenisa rakete",
    amount: 21900,
    description: "Universāla tenisa rakete"
  },
  "adidas-adipower-padel-33": {
    name: "Adidas Adipower Padel 3.3 rakete",
    amount: 17900,
    description: "Padela rakete"
  },
  "babolat-technical-viper": {
    name: "Babolat Technical Viper padel rakete",
    amount: 15900,
    description: "Padela rakete"
  },
  "innova-star-destroyer": {
    name: "Innova Star Destroyer disku golfa disks",
    amount: 1990,
    description: "Disku golfa distances draiveris"
  },
  "discraft-buzzz": {
    name: "Discraft Buzzz midrange disks",
    amount: 1850,
    description: "Disku golfa midrange disks"
  },
  "nike-strike-football": {
    name: "Nike Strike futbola bumba",
    amount: 3490,
    description: "Futbola treniņu bumba"
  },
  "trek-marlin-7": {
    name: "Trek Marlin 7 kalnu velosipēds",
    amount: 89900,
    description: "Kalnu velosipēds"
  },
  "giro-syntax-helmet": {
    name: "Giro Syntax velo ķivere",
    amount: 11900,
    description: "Velo ķivere"
  }
};

function getBaseUrl(event) {
  if (process.env.URL) {
    return process.env.URL.replace(/\/$/, "");
  }

  const host = event.headers.host;
  const protocol =
    event.headers["x-forwarded-proto"] ||
    event.headers["X-Forwarded-Proto"] ||
    "https";

  return `${protocol}://${host}`;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        Allow: "POST",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Only POST requests are allowed."
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const requestedItems = Array.isArray(body.items) ? body.items : [];

    if (!requestedItems.length) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Grozs ir tukšs."
        })
      };
    }

    const lineItems = [];

    for (const item of requestedItems) {
      const product = PRODUCTS[item.id];
      const quantity = Number(item.quantity);

      if (!product) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            error: "Prece nav atrasta."
          })
        };
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            error: "Nepareizs preces daudzums."
          })
        };
      }

      lineItems.push({
        quantity,
        price_data: {
          currency: "eur",
          product_data: {
            name: product.name,
            description: product.description
          },
          unit_amount: product.amount
        }
      });
    }

    const baseUrl = getBaseUrl(event);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "lv",
      line_items: lineItems,

      billing_address_collection: "required",

      shipping_address_collection: {
        allowed_countries: ["LV"]
      },

      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 299,
              currency: "eur"
            },
            display_name: "Pakomāta piegāde Latvijā",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 2
              },
              maximum: {
                unit: "business_day",
                value: 5
              }
            }
          }
        }
      ],

      custom_fields: [
        {
          key: "parcel_locker",
          label: {
            type: "custom",
            custom: "Omniva / DPD / Unisend pakomāta adrese"
          },
          type: "text",
          text: {
            minimum_length: 3,
            maximum_length: 200
          },
          optional: false
        }
      ],

      custom_text: {
        shipping_address: {
          message:
            "Piegāde ir pieejama tikai Latvijā. Norādiet savu pakomāta adresi."
        },
        submit: {
          message: "Pēc apmaksas saņemsiet pasūtījuma apstiprinājumu."
        }
      },

      success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?payment=cancelled`
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: session.url
      })
    };
  } catch (error) {
    console.error("Stripe Checkout error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Neizdevās sākt apmaksu. Mēģiniet vēlreiz."
      })
    };
  }
};