document.addEventListener("DOMContentLoaded", (event) => {
    //tjekker om brugeren er logged in
  fetch("http://localhost:3000/loggedstatus")
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      if (!data) {
        location.href = "/login";
      }else{
          location.href = "/Index"
      }
    })
    .catch(() => {
      window.alert("Der skete en fejl");
    })
});