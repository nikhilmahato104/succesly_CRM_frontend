import React from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Course = () => {
  const handlePayment = async () => {
    try {
      // 🔹 Step 1: Create Order
      const res = await fetch("https://darkdeep-learning-001.onrender.com/api/payment/create-order", {
        method: "POST",
      });

      const order = await res.json();

      // 🔹 Step 2: Razorpay Options
      const options = {
        key: "rzp_live_SUJloOpU326okt", // 🔥 yaha apna Razorpay Key ID daal
        amount: order.amount,
        currency: order.currency,
        name: "ELEARNING",
        description: "Course Payment ₹10",
        order_id: order.id,

        handler: async function (response: any) {
          console.log("Payment Success:", response);

          // 🔹 Step 3: Verify Payment
          const verifyRes = await fetch(
            "https://darkdeep-learning-001.onrender.com/api/payment/verify-payment",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(response),
            }
          );

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            alert("Payment Successful ✅ Course Unlocked 🎉");
          } else {
            alert("Payment Verification Failed ❌");
          }
        },

        prefill: {
          name: "Student",
          email: "student@gmail.com",
          contact: "9999999999",
        },

        theme: {
          color: "#3399cc",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error(error);
      alert("Payment Failed ❌");
    }
  };

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>🚀 Course: Dark Deep Learning</h1>
      <p>Price: ₹10</p>

      <button
        onClick={handlePayment}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          backgroundColor: "#3399cc",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius)",
          cursor: "pointer",
        }}
      >
        Buy Course ₹10
      </button>
    </div>
  );
};

export default Course;