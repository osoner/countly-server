function showMessage(key) {
	$("#message").text(jQuery.i18n.map[key]);
}

$(document).ready(function() {
	jQuery.i18n.properties({
		name:'pre-login', 
		path:'/localization/pre-login/',
		mode:'map',
		callback: function() {
			// Localization test
			//$.each(jQuery.i18n.map, function(key, value) {
			//	jQuery.i18n.map[key] = key;
			//});
			
			$("[data-localize]").each(function() {
				var elem = $(this),
					localizedValue = jQuery.i18n.map[elem.data("localize")];
				
				if (elem.is("input[type=text]") || elem.is("input[type=password]")) {
					elem.attr("placeholder", localizedValue);
				} else if (elem.is("input[type=button]") || elem.is("input[type=submit]")) {
					elem.attr("value", localizedValue);
				} else {
					elem.text(jQuery.i18n.map[elem.data("localize")]);
				}
			});
		}
	});

	$('body').noisy({
		intensity: 0.9, 
		size: 50, 
		opacity: 0.02,
		monochrome: true
	});
	
	$("#reset-password-form").submit(function() {
		if ($("input[name=password]").val() != $("input[name=again]").val()) {
			$("body").prepend($("<div>").attr("id", "message").text(jQuery.i18n.map["reset.dont-match"]));
			return false;
		}
	});
});