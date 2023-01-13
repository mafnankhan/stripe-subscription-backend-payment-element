const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();
const app = express();

app.use(bodyParser.json());

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    const trial_subscription = await stripe.subscriptions.update(
      "sub_1MPYhhLmMXaRzghn0986ejeS",
      { trial_end: 'now' }
    );

    // Fetch the customerId from the login context

    const actual_subscription = await stripe.subscriptions.create({
      customer: "cus_N9sSTcew7kn3V0",
      items: [{ price }],
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
    console.log(actual_subscription)

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

app.listen(8000, () =>
  console.log(`Node server listening at http://localhost:8000`)
);
