const router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    const axios = require("axios");
    const qs = require("qs");

    const stripeData = req.body;

    if (stripeData.type !== "checkout.session.completed") {
      return res.status(200).json({
        message: "Not a checkout event",
      });
    }

    var basicAuth =
      "Basic " +
      btoa(
        process.env.HIBOUTIK_API_USERNAME +
          ":" +
          process.env.HIBOUTIK_API_PASSWORD
      );

    const headers = {
      Accept: "application/json",
      Authorization: basicAuth,
    };

    let customerID = null;

    // find existing user
    axios({
      method: "get",
      url: `${process.env.HIBOUTIK_API_URL}/customers/search/?email=${stripeData.data.object.customer_details.email}`,
      headers,
      data: {},
    })
      .then(async function (resp) {
        if (resp.data.length === 0) {
          const userNamesArray =
            stripeData.data.object.customer_details.name.split(" ");
          const last_name = userNamesArray[userNamesArray.length - 1];
          const first_name = userNamesArray.slice(0, -1).join(" ");

          const userData = qs.stringify({
            customers_first_name: first_name,
            customers_last_name: last_name,
            customers_company: "",
            customers_email: stripeData.data.object.customer_details.email,
            customers_country:
              stripeData.data.object.customer_details.address.country,
            customers_tax_number: "",
            customers_phone_number:
              stripeData.data.object.customer_details.phone || "",
            customers_birth_date: "",
            customers_ref_ext: "",
            customers_misc: "",
          });

          // create new user
          await axios({
            method: "post",
            url: `${process.env.HIBOUTIK_API_URL}/customers`,
            headers,
            data: userData,
          })
            .then(function (response) {
              customerID = response.data.customers_id;
            })
            .catch((error) => {
              return res.status(500).json(error);
            });
        } else {
          customerID = resp.data[0].customers_id;
        }

        let data = qs.stringify({
          store_id: process.env.HIBOUTIK_API_STORE_ID,
          currency_code: stripeData.data.object.currency,
          customer_id: customerID,
          duty_free_sale: "0",
          prices_without_taxes: "0",
          quotation: "0",
          vendor_id: process.env.HIBOUTIK_API_VENDOR_ID,
        });

        let config = {
          method: "post",
          maxBodyLength: Infinity,
          url: "https://henrib.hiboutik.com/api/sales/",
          headers,
          data,
        };

        axios
          .request(config)
          .then((response) => {
            data = qs.stringify({
              sale_attribute: "payment",
              new_value: "STR",
            });

            let config = {
              method: "put",
              maxBodyLength: Infinity,
              url: `${process.env.HIBOUTIK_API_URL}/sale/${response.data.sale_id}`,
              headers,
              data,
            };

            axios
              .request(config)
              .then(() => {
                data = qs.stringify({
                  sale_id: response.data.sale_id,
                  product_id: process.env.HIBOUTIK_API_ACOMPTE_PRODUCT_ID,
                  stock_withdrawal: "1",
                });

                let config = {
                  method: "post",
                  maxBodyLength: Infinity,
                  url: `${process.env.HIBOUTIK_API_URL}/sales/add_product/`,
                  headers,
                  data,
                };

                axios
                  .request(config)
                  .then(() => {
                    res.status(200).json({
                      message: "Success",
                    });
                  })
                  .catch((error) => {
                    console.log(error);
                    res.status(500).json(error);
                  });
              })
              .catch((error) => {
                console.log(error);
                res.status(500).json(error);
              });
          })
          .catch((error) => {
            console.log(error.response.data.details);
            res.status(500).json(error.response.data.details);
          });
      })
      .catch((error) => {
        return res.status(500).json(error);
      });
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
