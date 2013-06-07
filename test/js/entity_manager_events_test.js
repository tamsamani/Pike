goog.require('pike.core.EntityManager');
goog.require('pike.events.NewEntity');
goog.require('goog.events.EventTarget');

var testCase = new goog.testing.ContinuationTestCase();
testCase.autoDiscoverTests();
G_testRunner.initialize(testCase);

function setUpPage(){}
function setUp(){}

function testNewEntity() {
	var em = new pike.core.EntityManager();
		
	var event = null;
    goog.events.listen(em, pike.events.NewEntity.EVENT_TYPE, function(e) {
    	event = e;
    });
		  
    waitForEvent(em, pike.events.NewEntity.EVENT_TYPE, function() {
    	assertTrue( event instanceof pike.events.NewEntity);
    	assertTrue( event.target === em);
    	assertNotNull(event.id);    
    });
         
    var entity = em.create();
};

function tearDown(){}
