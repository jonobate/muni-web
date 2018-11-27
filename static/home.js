$(document).ready(function(){
  console.log('document is ready')


  var helpers =
  {
      buildDropdown: function(result, dropdown, emptyMessage)
      {
          // Remove current options
          dropdown.html('');
          // Add the empty option with the empty message
          dropdown.append('<option value="">' + emptyMessage + '</option>');
          // Check result isnt empty
          if(result != '')
          {
              // Loop through each of the results and append the option to the dropdown
              $.each(result, function(k, v) {
                  dropdown.append('<option value="' + v.value + '">' + v.label + '</option>');
              });
          }
      }
  }


  $( "#route, #direction" ).change(async function() {
    console.log( "Route or direction changed" );
    var selectedRoute = $("#route").children("option:selected").val();
    var selectedDirection = $("#direction").children("option:selected").val();

    if (selectedRoute != "None" && selectedDirection != "None") {

      var data = {
        selectedRoute,
        selectedDirection
      }

      var response = await $.ajax('/stops',{
        data: JSON.stringify(data),
        method: "post",
        contentType: "application/json"
      })
      console.log("We got a response!")

      //Populate departure stops
      helpers.buildDropdown(
          response,
          $('#departure'),
          'Select a Departure Stop'
      );

      //Populate arrival stops
      helpers.buildDropdown(
          response,
          $('#arrival'),
          'Select an Arrival Stop'
      );
    }
  })

  $('#predict').click(async function(){
    console.log( "Predict button was clicked" );
    var selectedRoute = $("#route").children("option:selected").val();
    var selectedDirection = $("#direction").children("option:selected").val();
    var selectedDeparture = $("#departure").children("option:selected").val();
    var selectedArrival = $("#arrival").children("option:selected").val();
    var selectedDate = new Date($('#date').val());
    var selectedTime = $('#time').val().split(':');

    if (selectedRoute != "None"
        && selectedDirection != "None"
        && selectedDeparture != "None"
        && selectedArrival != "None"
        && selectedDate != "None"
        && selectedTime != "None") {

      $('<p>Reticulating splines...</p>').appendTo('#distribution');

      //Add offset to fix local/UTC time issue
      selectedDate.setTime( selectedDate.getTime() + selectedDate.getTimezoneOffset()*60*1000 );

      //Add hours from time object
      selectedDate.setHours(selectedDate.getHours()+selectedTime[0]);

      const data = {
        selectedDeparture,
        selectedArrival,
        selectedDate,
      }
    console.log(data)
    const response = await $.ajax('/predict',{
      data: JSON.stringify(data),
      method: "post",
      contentType: "application/json"
    })
    console.log("We got a response!")
    console.log(response)

    const x = response.map(a => a[0])
    const y = response.map(a => a[1])

    const trace1 = [{
      x:x,
      y:y,
      mode:'markers',
      type:'scatter'
    }]

    const layout = {
      xaxis:{
        title:'Journey Time (secs)'
      },
      yaxis:{
        title:'Probability (%)'
      },
      title:'Journey Time Distribution',
      width:700,
      height:300
    }
    Plotly.plot($('#distribution')[0],trace1,layout)
  }
})
});
