/**
* @fileoverview Layer
* @author tomasjurman@gmail.com (Tomas Jurman)
* @license Dual licensed under the MIT or GPL licenses.
*/
goog.provide('pike.layers.Layer');
goog.provide('pike.layers.ClusterLayer');

goog.require('goog.events');
goog.require('goog.events.EventTarget');
goog.require('goog.events.EventHandler');
goog.require('pike.events.NewEntity');
goog.require('pike.events.RemoveEntity');
goog.require('pike.core.Entity');
goog.require('pike.graphics.Cluster');

/**
 * Create a new layer
 * @param {string} name
 * @constructor
 * @extends {goog.events.EventTarget}
 */
pike.layers.Layer = function( name ){
	goog.events.EventTarget.call(this);
	
	this.name = name;
	
	/**
	* @type {!goog.events.EventHandler}
	* @protected
	*/
	this.handler = new goog.events.EventHandler(this);
	
	this.viewport_ = new pike.graphics.Rectangle(0,0,0,0);
	this.gameWorld_ = new pike.graphics.Rectangle(0,0,0,0);
	
	this.entities_ = [];
	this.screen_ = {};
	this.offScreen_ = {}; 
	
	this.screen_.canvas = document.createElement("canvas");	
	this.screen_.canvas.style.position  = "absolute";
	this.screen_.canvas.style.top  = "0";
	this.screen_.canvas.style.left  = "0";        		
	this.screen_.context = this.screen_.canvas.getContext('2d');
	this.screen_.isDirty = false;
	        		        	
	this.offScreen_.canvas = document.createElement("canvas");  	
	this.offScreen_.context = this.offScreen_.canvas.getContext('2d');
	this.offScreen_.isDirty = false; 	
};

goog.inherits(pike.layers.Layer, goog.events.EventTarget);

/**
 * Set internal viewport size
 * @param {numner} width
 * @param {number} height
 */
pike.layers.Layer.prototype.setViewportSize = function(width, height){
	this.viewport_.w = width;
	this.viewport_.h = height;
	
	this.screen_.canvas.width = this.viewport_.w;
	this.screen_.canvas.height = this.viewport_.h;
	this.screen_.isDirty = true;
	
	if(this.hasDirtyManager()){		
		this.dirtyManager.setSize( this.viewport_.w, this.viewport_.h );
	}
};

/**
 * Set internal gameWorld size
 * @param {numner} width
 * @param {number} height
 */
pike.layers.Layer.prototype.setGameWorldSize = function(width, height){
	this.gameWorld_.w = width;
	this.gameWorld_.h = height;
	
	this.offScreen_.canvas.width = this.gameWorld_.w;
	this.offScreen_.canvas.height = this.gameWorld_.h;
	this.offScreen_.isDirty = true;
};

/**
 * Set internal viewport position
 * @param {numner} x
 * @param {number} y
 */
pike.layers.Layer.prototype.setViewportPosition = function(x,y){
	this.viewport_.x = x;
	this.viewport_.y = y;
		
	if(this.hasDirtyManager()){
		this.dirtyManager.setPosition( this.viewport_.x, this.viewport_.y);	
	}
};

/**
 * Set dirty manager 
 * @param {pike.layers.DirtyManager} dirtyManager
 */
pike.layers.Layer.prototype.setDirtyManager = function( dirtyManager ){	
	this.dirtyManager = dirtyManager;	
};

/**
 * Determines whether the layer has a DirtyManager
 * @return {boolean}
 */
pike.layers.Layer.prototype.hasDirtyManager = function(){
	return this.dirtyManager; //TODO
};

/**
 * Get a screen object
 * @returns {Object}
 */
pike.layers.Layer.prototype.getScreen = function(){
	return this.screen_;
};

/**
 * Get a offScreen object
 * @returns {Object}
 */
pike.layers.Layer.prototype.getOffScreen = function(){
	return this.offScreen_;
};

/**
 * Add a entity to the layer
 * @param {pike.core.Entity} entity
 * @fires {pike.events.NewEntity} newentity
 */
pike.layers.Layer.prototype.addEntity = function( entity ){		 	
	this.entities_.push( entity );
	entity.layer = this;
	this.dispatchEvent( new pike.events.NewEntity( entity, this) );
	if(goog.DEBUG) console.log("[pike.core.Layer] Layer: " + this.name + " has newentity #" + entity.id);	
};

/**
 * Remove entity
 * @param {pike.core.Entity} entity
 * @fires {pike.events.RemoveEntity} removeentity
 */
pike.layers.Layer.prototype.removeEntity = function( entity ){
	entity.dispose();
	goog.array.remove(this.entities_, entity);
	delete entity.layer;
	this.dispatchEvent( new pike.events.RemoveEntity( entity, this));
	if(goog.DEBUG) console.log("[pike.core.Layer] removeentity");
};

/**
 * @override
 */
pike.layers.Layer.prototype.dispatchEvent = function( e ){
	
	for(var idx = 0; idx < this.entities_.length; idx++){
		this.entities_[idx].dispatchEvent(e);
	}
	
	goog.events.EventTarget.prototype.dispatchEvent.call(this, e);
};

//## ClusterLayer #################################################
/**
 * Create a new Cluster layer
 * @param {string} name
 * @param {numner} clusterSize - px
 * @constructor
 * @extends {pike.layers.Layer}
 */
pike.layers.ClusterLayer = function( name, clusterSize ){
	pike.layers.Layer.call(this, name);
		   
    this.clusters_ = new pike.graphics.Cluster(clusterSize, 0, 0);

    /* currently visible clusters */
    this.visibleClusterBounds_ = {};

    /* the sorted array of objects from active clusters, no duplicates*/
    this.cache_ = [];

    /* true if cache needs to be fully rebuilt */
    this.cacheDirty_ = true;

    /* true if cache only needs to be sorted (when object moved for example) */
    this.cacheUnsorted_ = false;   
            
};

goog.inherits(pike.layers.ClusterLayer, pike.layers.Layer);


/**
 * Cluster instance attached to this layer
 * @return {pike.graphics.Cluster} 
 */
pike.layers.ClusterLayer.prototype.getCluster = function(){
	return this.clusters_;
};

/**
 * @override
 */
pike.layers.ClusterLayer.prototype.dispatchEvent = function( e ){
	
	if (this.cacheDirty_) {			
		this.resetCache_();
	} else if (this.cacheUnsorted_) {		
		this.sortCache_();
	}
	
	for (var i = 0; i < this.cache_.length; i++) {
		var entity = this.cache_[i];
		if (entity.getBounds().intersects(this.viewport_)) {
			entity.dispatchEvent(e);
		}
	}

	goog.events.EventTarget.prototype.dispatchEvent.call(this, e);
};

/**
 * Add a entity to the layer
 * @param {pike.core.Entity} entity
 * @fires {pike.events.NewEntity} newentity
 * @override
 */
pike.layers.ClusterLayer.prototype.addEntity = function( entity ){	
	pike.layers.Layer.prototype.addEntity.call(this, entity);	
	this.handler.listen(entity, pike.events.ChangePosition.EVENT_TYPE, goog.bind( this.onEntityMove, this ));
		
	//Cluster will build after attached to stage
	if( this.clusters_.getClusters().length == 0 ){
		return
	}
		
	var clusters = this.clusters_.addToClusters( entity );
	if (clusters.intersects(this.visibleClusterBounds_)) {			
		this.cache_.push( entity );
		this.cacheUnsorted_ = true;			
	}
};

/**
 * Remove entity
 * @param {pike.core.Entity} entity
 * @fires {pike.events.RemoveEntity} removeentity
 * @override
 */
pike.layers.ClusterLayer.prototype.removeEntity = function( entity ){
	this.clusters_.removeFromClusters(entity);	
	pike.layers.Layer.prototype.removeEntity.call(this, entity);
};

pike.layers.ClusterLayer.prototype.resetCache_ = function(){
	var cache = this.cache_ = [];
    for (var i = this.visibleClusterBounds_.y; i < this.visibleClusterBounds_.y + this.visibleClusterBounds_.h; i++) {
        for (var j = this.visibleClusterBounds_.x; j < this.visibleClusterBounds_.x + this.visibleClusterBounds_.w; j++) {
            var cluster = this.clusters_.getClusters()[i][j];
            for (var k = 0; k < cluster.length; k++) {
                if (cache.indexOf(cluster[k]) == -1) {                	
                    cache.push(cluster[k]);
                }
            }
        }
    }
    
    if(goog.DEBUG) console.log("[pike.layers.ClusterLayer] resetcache");
    
    this.sortCache_();
    this.cacheDirty_ = false;
    this.cacheUnsorted_ = false;    
};

/**
 * @private
 */
pike.layers.ClusterLayer.prototype.sortCache_ = function() {
    this.cache_.sort(function(a, b) {
        var aBounds = a.getBounds();
        var bBounds = b.getBounds();

        return (aBounds.y + aBounds.h) - (bBounds.y + bBounds.h);
    });
        
    this.cacheUnsorted_ = false;
    if(goog.DEBUG) console.log("[pike.layers.ClusterLayer] sortcache");
};

/**
 * Recreate the clusters
 * @private
 */
pike.layers.ClusterLayer.prototype.resetClusters_ = function(){		
	this.clusters_.build();
		
	if(goog.DEBUG) console.log("[pike.layers.ClusterLayer] resetcluster");
	
	for (var i=0; i < this.entities_.length; i++) {
        var entity = this.entities_[i];  
        this.clusters_.addToClusters(entity); 
    }		
};

pike.layers.ClusterLayer.prototype.updateVisibleClusters_ = function(){
	var newRect = this.viewport_.getOverlappingGridCells(
			this.clusters_.getClusterSize(),
			this.clusters_.getClusterSize(),
			this.clusters_.getClusters()[0].length,
			this.clusters_.getClusters().length);

    if (!newRect.equals(this.visibleClusterBounds_)) {
        this.visibleClusterBounds_ = newRect;
        this.cacheDirty_ = true;        
    }	
};

/**
 * Set internal viewport size
 * @param {number} x
 * @param {number} y
 * @override
 */
pike.layers.ClusterLayer.prototype.setViewportSize = function(width, height) {
	pike.layers.Layer.prototype.setViewportSize.call(this, width, height);
	
	this.setGameWorldSize.call(this, 
			Math.max(this.gameWorld_.w, width), 
			Math.max(this.gameWorld_.h, height));
	
	this.updateVisibleClusters_();	
};

/**
 * Set internal viewport position
 * @param {number} x
 * @param {number} y
 * @override
 */
pike.layers.ClusterLayer.prototype.setViewportPosition = function(x, y) {
	pike.layers.Layer.prototype.setViewportPosition.call(this, x, y);	
	this.updateVisibleClusters_();		
};

/**
 * Set internal gameworld size
 * @param {number} x
 * @param {number} y
 * @override
 */
pike.layers.ClusterLayer.prototype.setGameWorldSize = function(width, height) {	
	pike.layers.Layer.prototype.setGameWorldSize.call(this, width, height);	
	this.clusters_.setSize(width, height);
	this.resetClusters_();	
};

/**
 * on entity move handler
 * @param {pike.events.Move} e
 */
pike.layers.ClusterLayer.prototype.onEntityMove = function(e){	
	var entity = e.target;
	var newClusters = entity.getBounds().getOverlappingGridCells(
			this.clusters_.getClusterSize(),
			this.clusters_.getClusterSize(),
			this.clusters_.getClusters()[0].length,
			this.clusters_.getClusters().length);
	
	var oldClusters = this.clusters_.getIdToClusterBounds(entity.id);
	
	if (!oldClusters.equals(newClusters)) {
		this.moveObjectBetweenClusters_(entity, oldClusters, newClusters);		
	}
		
	if (newClusters.intersects(this.visibleClusterBounds_) && e.y != e.oldY) {
		this.cacheUnsorted_ = true;		
	}	
};

pike.layers.ClusterLayer.prototype.moveObjectBetweenClusters_ = function( entity, oldClusters, newClusters) {
	this.clusters_.removeFromClusters(entity, oldClusters);
	this.clusters_.addToClusters(entity, newClusters);
	this.clusters_.setIdToClusterBounds(entity.id, newClusters);
	
	// If object has left the screen, remove from cache
	if (newClusters.intersects(this.visibleClusterBounds_)) {
		
		if(!goog.array.contains(this.cache_, entity)){
			this.cache_.push(entity);
		}
		
	} else {		
		goog.array.remove(this.cache_, entity);
	}
};
	
