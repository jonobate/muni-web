$(document).ready(function() {
  console.log('document is ready')


  var helpers = {
    buildDropdown: function(result, dropdown, emptyMessage) {
      // Remove current options
      dropdown.html('');
      // Add the empty option with the empty message
      dropdown.append('<option value="None">' + emptyMessage + '</option>');
      // Check result isnt empty
      if (result != '') {
        // Loop through each of the results and append the option to the dropdown
        $.each(result, function(k, v) {
          dropdown.append('<option value="' + v.value + '">' + v.label + '</option>');
        });
      }
    }
  }


  $("#route, #direction").change(async function() {
    console.log("Route or direction changed");
    var selectedRoute = $("#route").children("option:selected").val();
    var selectedDirection = $("#direction").children("option:selected").val();

    if (selectedRoute !== "None" && selectedDirection !== "None") {

      var data = {
        selectedRoute,
        selectedDirection
      }

      var response = await $.ajax('/stops', {
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

  $('#predict').click(async function() {
    console.log("Predict button was clicked");
    var selectedRoute = $("#route").children("option:selected").val();
    var selectedDirection = $("#direction").children("option:selected").val();
    var selectedDeparture = $("#departure").children("option:selected").val();
    var selectedArrival = $("#arrival").children("option:selected").val();
    var selectedDate = new Date($('#date').val());
    var selectedTime = $('#time').val().split(':');

    if (selectedRoute !== "None" &&
      selectedDirection !== "None" &&
      selectedDeparture !== "None" &&
      selectedArrival !== "None" &&
      selectedDate !== "None" &&
      selectedTime !== "None") {

      Plotly.purge($('#distribution')[0]);

      document.getElementById("waiting").innerHTML='<font color="red">Reticulating splines...</font>';

      //Add offset to fix local/UTC time issue
      selectedDate.setTime(selectedDate.getTime() + selectedDate.getTimezoneOffset() * 60 * 1000);

      //Add hours from time object
      selectedDate.setHours(selectedDate.getHours() + selectedTime[0]);

      const data = {
        selectedDeparture,
        selectedArrival,
        selectedDate,
      }
      console.log(data)
      const response = await $.ajax('/predict', {
        data: JSON.stringify(data),
        method: "post",
        contentType: "application/json"
      })
      console.log("We got a response!")
      console.log(response)

      var xy = response.data
      var p50 = response.p50
      var p95 = response.p95

      const x = xy.map(a => a[0])
      const y = xy.map(a => a[1])

      const trace1 = [{
        x: x,
        y: y,
        mode: 'markers',
        type: 'scatter'
      }]

      const layout = {
        xaxis: {
          title: 'Total Journey Time (mins)'
        },
        yaxis: {
          autorange: true,
          showgrid: false,
          zeroline: false,
          showline: false,
          autotick: true,
          ticks: '',
          showticklabels: false
        },

        annotations: [
          {
            x: p50,
            y: 0,
            xref: 'x',
            yref: 'y',
            text: 'Average: '+ p50 + ' mins',
            showarrow: true,
            arrowhead: 7,
            ax: 0,
            ay: -40
          },
          {
            x: p95,
            y: 0,
            xref: 'x',
            yref: 'y',
            text: 'Worst-case: '+ p95 + ' mins',
            showarrow: true,
            arrowhead: 7,
            ax: 0,
            ay: -80
          }
        ],

        title: 'Journey Time Distribution',
        width: 600,
        height: 400
      }
      document.getElementById("waiting").innerHTML="";
      Plotly.plot($('#distribution')[0], trace1, layout)
    } else {
      document.getElementById("waiting").innerHTML='<font color="red">Please select options above</font>';
    }
  })
});
