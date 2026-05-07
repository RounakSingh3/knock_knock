const url = "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/media/test.txt";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cnVvc3ZscW5wY3V6YXlycWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTkxODUsImV4cCI6MjA4ODEzNTE4NX0.UcU8kEa20Sxw_txzGDvbmu-fWm60hOuCMQRgN-hhJ_I";

fetch(url, {
    method: "POST",
    headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
    },
    body: "Test content from script"
}).then(async (res) => {
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
}).catch(err => {
    console.log("Error:", err);
});
