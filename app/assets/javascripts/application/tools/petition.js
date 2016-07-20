$(document).on('ready', function() {
  _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;

  $('form.petition-tool').on('submit', function(ev) {
    var form = $(ev.currentTarget);
    function show_error(error) {
      form.find(".progress-striped").hide();
      form.find("input[type=submit]").show();
      form.find('.alert-danger').remove();
      form.prepend($('<div class="small alert alert-danger help-block">').text(error));
    }

    function incrementPetitionCount() {
      var n = getPetitionCount() + 1;
      setPetitionCountValue(n);
    }

    // give it an integer and it prints it all pretty on the screen
    function setPetitionCountValue(n) {
      var countEle = petitionCountElement();
      countEle.text(applyPrettyFormatting(n));

      function applyPrettyFormatting() {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }
    }

    function getPetitionCount() {
      var countEle = petitionCountElement();
      return parseInt(countEle.text().replace(",",""));
    }

    function petitionCountElement() {
      return $('#petition-tool .count b');
    }


    // There are two types of errors: inline (.has-error) and not (.alert-danger)
    form.find('.has-error').removeClass('has-error');
    form.find('.alert-danger').remove();
    form.find('.error').remove();
    form.find(".progress-striped").show();
    form.find("input[type=submit]").hide();
    var petition_id = $('[name="petition-id"]', form).val();
    // var url = 'http://eff-call-tool.herokuapp.com/eff_test';
    var url = '/tools/petition';
    $.ajax({
      url: url,
      data: form.serializeObject(),
      type: 'POST',
      success: function(data) {
        if (data.success) {
          $('#petition-tool').removeClass('unsigned').addClass('signed');
          height_changed();
          incrementPetitionCount();
        }
        else if (data.errors) {
          var errors = JSON.parse(data.errors);
          for (var field_name in errors) {
            var field = form.find("#signature_" + field_name);
            var error = errors[field_name];
            if (field.length) {
              error = $('<div class="error help-block small">').text(error);
              error.prepend(field.attr('placeholder') + ': ');
              field.closest('fieldset').addClass('has-error');
              error.insertAfter(field);
              form.find(".progress-striped").hide;
              form.find("input[type=submit]").show();
            }
            else {
              show_error(error);
            }
          }
        }
      },
      error: function() {
        show_error("Something seems to have gone wrong. Please try again.");
      }
    });
    return false;
  });

  var getSignaturesInterval = 2000;
  var previousSignatures = {};
  var getSignatures = function(){
    $.ajax({
      url: '/petition/' + petition_id + '/recent_signatures',
      success: function(data){
        var signatures_total = data.signatures_total;
        setPetitionCountValue(signatures_total);

        var progress_total = $('.signatures-bar').attr('aria-valuemax');
        $(".signatures-bar").attr('aria-valuenow', signatures_total).css({width: signatures_total/progress_total*100 + '%'});
        var signatures = data.signatories;
        var individual_signature_template = $('#individual_signature').html();
        var signatures_html = _.map(signatures, function(signature){
          return _.template(individual_signature_template)({
            name: (signature.first_name ? signature.first_name + " " + signature.last_name : "Anonymous"),
            location: signature.location,
            time_ago: signature.time_ago + " ago"
          });
        }).join("");
        $("div#signatures tbody").html(signatures_html);

        // did anything change? if no, wait longer til next check.
        if (_.isEqual(data, previousSignatures)) {
          getSignaturesInterval *= 2;
        } else {
          getSignaturesInterval = 2000;
        }
        previousSignatures = data
        window.setTimeout(getSignatures, getSignaturesInterval);
      },
      error: function() {
        window.setTimeout(getSignatures, getSignaturesInterval);
      }
    });
  }

  var zip_pattern = '\\d{5}(-?\\d{4})?';

  if($('#petition-tool').length != 0) {
    window.setTimeout(getSignatures, getSignaturesInterval);

    if ($('#location.require').length) {
      $('#signature_zipcode').attr('required', 'required')
      $('#signature_zipcode').attr('pattern', zip_pattern);
    }

    // Users must input complete institution/relationship pairs.
    $('#affiliations').on('change', 'select', function() {
      var select_pair = $(this).closest('.nested-fields').find('select');
      var at_least_one_selected = _.reduce(select_pair, function(m, n) {
        return m + $(n).val().length;
      }, 0);
      select_pair.prop('required', at_least_one_selected);
    });
  }

  function initAffiliation() {
    // Autocomplete select using select2
    $('#affiliations select.institution').select2({
      theme: 'bootstrap',
      placeholder: 'Institution'
    });

    // Greyed-out placeholder text
    $('#affiliations select').on('change', function() {
      $(this).toggleClass("empty", $.inArray($(this).val(), ['', null]) >= 0);
    }).trigger('change');
  }

  initAffiliation();
  $('#affiliations').on('cocoon:after-insert', function(e, insertedItem) {
    initAffiliation();
  });

  // Autocomplete filter by institution
  $('#signatures select.institution').select2({
    theme: 'bootstrap',
    placeholder: 'Filter by institution'
  });


  $('.intl-toggler').click(function(e) {
    $('.intl-toggle').toggle();
    height_changed();
    if ($('#location.require').length) {
      if ($('.intl:visible').length) {
        $('#signature_zipcode').removeAttr('required');
        $('#signature_zipcode').removeAttr('pattern');
        $('#signature_city, #signature_country_code').attr('required', 'required');
      } else {
        $('#signature_zipcode').attr('required', 'required')
        $('#signature_zipcode').attr('pattern', zip_pattern);
        $('#signature_city, #signature_country_code').removeAttr('required');
      }
    }
  });
});
