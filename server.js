const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();
const app = express();

app.use(bodyParser.json());

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.get("/", async (req, res) => {
  res.send('Ping OK!')
})

app.post("/signup", async (req, res) => {
  try {

    const { email, name } = req.body;

    // Create customer in the stripe
    const customer = await stripe.customers.create({
      email: email,
      name: name,
      metadata: {
        env: 'develop'
      }
    });

    // store the customerId in the database
    console.log(customer)

    // Use this trial subscription
    const trial_subscription = {
      price: 'price_1MPYeMLmMXaRzghnRlVJ8x72',
    }

    // Now create the trial subscription for 10 days
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [trial_subscription],
      trial_period_days: 10,
    });

    // Save this subscriptionId in the database
    console.log(subscription)

    // Send customer and trial subscription details
    res.status(200).send({
      customer,
      subscription
    });
  } catch (e) {
    return res.status(400).send({
      message: e.message,
    });
  }
});

app.post("/charge-customer", async (req, res) => {
  try {

    const { price } = req.body;

    // Now end the trial subscription, replace this subscriptionId, which will be fetch from the database
    // await stripe.subscriptions.update(
    //   "sub_1MPqQILmMXaRzghnA3V5fhy4",
    //   { trial_end: 'now' }
    // );

    // Also remove the subscription from the customer
    // await stripe.subscriptions.del("sub_1MPqQILmMXaRzghnA3V5fhy4")

    // Fetch the customerId from the login context

    const actual_subscription = await stripe.subscriptions.create({
      customer: "cus_NAAlzXYRjh34Uu",
      items: [{ price }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_options: {
          card: {
            request_three_d_secure: 'any',
          },
        },
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Save this subscriptionId in the database
    // console.log(actual_subscription)

    // Send clientSecret which will be used for confirm payment
    res.status(200).send({
      clientSecret: actual_subscription.latest_invoice.payment_intent.client_secret,
      subscriptionId: actual_subscription.id,
    });
  } catch (e) {
    return res.status(400).send({
      message: e.message,
    });
  }
});

app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
  const sig = request.headers['stripe-signature'];

  console.log('Webhook Fired !')

  let event = request.body

  // This will work only on production
  if (process.env.NODE_ENV === 'production') {
      const signingSecret = 'whsec_Yo6Vf37xckwODoZ2TUhtnaCJHcfbAw0U'
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, signingSecret);
    } catch (err) {
      console.error(err)
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  }

  // Handle the event
  switch (event.type) {
    case 'invoice.payment_succeeded':
      const paymentSucceed = event.data.object;
      console.log(paymentSucceed)
      // update billing status with some attributes
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.status(200).send();
});

app.listen(8000, () =>
  console.log(`Node server listening at http://localhost:8000`)
);
